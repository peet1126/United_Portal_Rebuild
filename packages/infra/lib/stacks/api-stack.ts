import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  dbProxy: rds.DatabaseProxy;
  dbSecret: secretsmanager.Secret;
  lambdaSecurityGroup: ec2.SecurityGroup;
  vpc: ec2.Vpc;
}

export class ApiStack extends cdk.Stack {
  public readonly graphqlUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // ----------------------------------------------------------------
    // Lambda resolver function
    //
    // NodejsFunction runs esbuild at deploy time to produce a single
    // bundled JS file. This means:
    // - No node_modules shipped to Lambda — bundle is small and cold
    //   start is fast.
    // - @aws-sdk/* is marked external because Node.js 20 Lambda runtime
    //   ships AWS SDK v3 pre-installed. Bundling it in would just add size.
    // - The entry path crosses package boundaries (infra → lambda). CDK
    //   resolves this via the absolute path at synth time; esbuild then
    //   follows the import graph from there, including the workspace
    //   symlink for @united-portal/shared.
    //
    // The function runs inside the VPC (Private subnets) so it can reach
    // the RDS Proxy, which is also in Private subnets. allowAllOutbound
    // on the Lambda SG lets it reach Secrets Manager and the Cognito
    // endpoints over the NAT Gateway.
    // ----------------------------------------------------------------
    const resolverFn = new lambda_nodejs.NodejsFunction(this, 'ResolverFn', {
      entry: path.join(__dirname, '../../../lambda/src/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      timeout: cdk.Duration.seconds(30),
      environment: {
        NODE_ENV: 'production',
        DB_PROXY_ENDPOINT: props.dbProxy.endpoint,
        DB_NAME: 'united_portal',
        // 'admin' is the master username set in FoundationStack's DbSecret.
        // In production you'd create a least-privilege DB user and use that.
        DB_IAM_USER: 'admin',
      },
      bundling: {
        // @aws-sdk/* is pre-installed in the Lambda Node.js 20 runtime.
        // The remaining entries are Sequelize's optional dialect drivers —
        // it ships with conditional requires for every DB it supports, and
        // esbuild tries to bundle them all. We only use mysql2, so everything
        // else is safe to mark external (they'll never be imported at runtime).
        externalModules: [
          '@aws-sdk/*',
          'pg', 'pg-hstore', 'pg-native',
          'sqlite3', 'better-sqlite3',
          'tedious',
          'oracledb',
        ],
        // Sequelize loads dialect drivers via a dynamic require(variableName)
        // that esbuild cannot statically trace, so mysql2 never ends up in
        // the bundle. nodeModules installs it into a real node_modules/ folder
        // next to the bundled index.js so the dynamic require finds it at runtime.
        nodeModules: ['mysql2'],
      },
    });

    // ----------------------------------------------------------------
    // IAM grant: Lambda → RDS Proxy
    //
    // grantConnect adds the rds-db:connect action to the Lambda execution
    // role, scoped to this proxy and the 'admin' DB user.
    //
    // How IAM auth to RDS Proxy works:
    // 1. Lambda calls @aws-sdk/rds-signer to generate a short-lived token
    //    (a presigned URL, valid 15 min).
    // 2. Lambda connects to the proxy presenting that token as the password.
    // 3. The proxy validates the token against IAM. This check only passes
    //    if the Lambda role has rds-db:connect — which grantConnect adds.
    // 4. The proxy then opens (or reuses) a real MySQL connection using the
    //    credentials it holds in Secrets Manager, transparent to Lambda.
    // ----------------------------------------------------------------
    props.dbProxy.grantConnect(resolverFn, 'admin');

    // ----------------------------------------------------------------
    // AppSync GraphQL API
    //
    // USER_POOL auth means every operation requires a valid Cognito JWT
    // in the Authorization header. AppSync validates the token against our
    // User Pool before the resolver even fires — the Lambda never sees an
    // unauthenticated request.
    //
    // FieldLogLevel.ERROR logs only resolver errors to CloudWatch, not
    // every request. Verbose logging (ALL) is useful for debugging but
    // doubles costs at any real traffic level.
    // ----------------------------------------------------------------
    const api = new appsync.GraphqlApi(this, 'Api', {
      name: 'united-portal-api',
      schema: appsync.SchemaFile.fromAsset(
        path.join(__dirname, '../../schema.graphql'),
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: props.userPool,
          },
        },
      },
      logConfig: {
        excludeVerboseContent: true,
        fieldLogLevel: appsync.FieldLogLevel.ERROR,
      },
    });

    // ----------------------------------------------------------------
    // Lambda data source + resolver wiring
    //
    // A data source is AppSync's reference to a backend resource. Adding
    // a Lambda data source also grants AppSync permission to invoke the
    // function (it creates the lambda:InvokeFunction policy automatically).
    //
    // MappingTemplate.lambdaRequest() / lambdaResult() are the standard
    // VTL templates for Lambda resolvers. They serialize the AppSync
    // context (arguments, identity, source) into the event shape that
    // AppSyncResolverEvent<T> represents in our Lambda code.
    // ----------------------------------------------------------------
    const lambdaDs = api.addLambdaDataSource('ResolverDataSource', resolverFn);

    const operations: Array<{ typeName: string; fieldName: string }> = [
      { typeName: 'Query',    fieldName: 'getTicket' },
      { typeName: 'Query',    fieldName: 'listTickets' },
      { typeName: 'Mutation', fieldName: 'createTicket' },
      { typeName: 'Mutation', fieldName: 'updateTicket' },
    ];

    for (const { typeName, fieldName } of operations) {
      lambdaDs.createResolver(`${typeName}${fieldName}Resolver`, {
        typeName,
        fieldName,
        requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
        responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
      });
    }

    this.graphqlUrl = api.graphqlUrl;

    new cdk.CfnOutput(this, 'GraphqlUrl', { value: api.graphqlUrl });
    new cdk.CfnOutput(this, 'GraphqlApiId', { value: api.apiId });
  }
}
