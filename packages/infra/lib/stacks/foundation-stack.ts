import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class FoundationStack extends cdk.Stack {
  // These are exposed as public properties so ApiStack and FrontendStack
  // can reference them. CDK tracks these as cross-stack dependencies and
  // handles the CloudFormation exports/imports automatically.
  public readonly vpc: ec2.Vpc;
  public readonly dbProxy: rds.DatabaseProxy;
  public readonly dbSecret: secretsmanager.Secret;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // ----------------------------------------------------------------
    // VPC
    // Three subnet tiers: Public, Private (with NAT), Isolated (no internet).
    //
    // Why three tiers?
    // - Public:   NAT Gateway lives here. Internet-facing load balancers go here.
    // - Private:  Lambda and RDS Proxy live here. They can reach the internet
    //             via NAT (to call Secrets Manager, Cognito, etc.) but are not
    //             directly reachable from the internet.
    // - Isolated: RDS lives here. No internet access at all — the only ingress
    //             is from the RDS Proxy security group on port 3306.
    //
    // natGateways: 1 keeps cost down (~$32/month). Production would use 2+
    // for high availability across AZs.
    // ----------------------------------------------------------------
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 28, // /28 = 16 IPs — plenty for RDS
        },
      ],
    });

    // ----------------------------------------------------------------
    // Security Groups
    //
    // Security groups act as stateful firewalls at the resource level.
    // We create three and explicitly define what can talk to what:
    //
    //   Lambda → RDS Proxy (port 3306)
    //   RDS Proxy → RDS   (port 3306)
    //
    // Nothing else. RDS is not reachable from Lambda directly —
    // all connections must go through the proxy.
    // ----------------------------------------------------------------
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSG', {
      vpc: this.vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    const rdsProxySG = new ec2.SecurityGroup(this, 'RdsProxySG', {
      vpc: this.vpc,
      description: 'Security group for RDS Proxy',
      allowAllOutbound: false,
    });

    const rdsSG = new ec2.SecurityGroup(this, 'RdsSG', {
      vpc: this.vpc,
      description: 'Security group for RDS instance',
      allowAllOutbound: false,
    });

    // RDS Proxy can reach RDS
    rdsSG.addIngressRule(rdsProxySG, ec2.Port.tcp(3306), 'RDS Proxy to RDS');

    // Lambda can reach RDS Proxy
    rdsProxySG.addIngressRule(this.lambdaSecurityGroup, ec2.Port.tcp(3306), 'Lambda to RDS Proxy');

    // ----------------------------------------------------------------
    // Database credentials
    //
    // We let Secrets Manager generate a random password. Lambda never
    // sees this password directly — it uses IAM auth to connect to the
    // proxy, which handles the credential rotation transparently.
    // ----------------------------------------------------------------
    this.dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: 'united-portal/db-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // ----------------------------------------------------------------
    // RDS MySQL
    //
    // t3.micro is the cheapest option (~$15/month). Fine for learning.
    // Multi-AZ is off — that doubles the cost and isn't needed here.
    //
    // removalPolicy: DESTROY means `cdk destroy` will delete the DB.
    // In production this would be RETAIN or SNAPSHOT.
    // ----------------------------------------------------------------
    const db = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [rdsSG],
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      databaseName: 'united_portal',
      multiAz: false,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ----------------------------------------------------------------
    // RDS Proxy
    //
    // This is the key piece for Lambda + RDS. The problem it solves:
    //
    // Lambda functions are stateless and spin up a new process per
    // invocation (at scale). Each process tries to open a new MySQL
    // connection. RDS has a hard connection limit (~60 for t3.micro).
    // At any meaningful traffic level, you exhaust the connection pool
    // and get "too many connections" errors.
    //
    // RDS Proxy maintains a persistent pool of connections to RDS and
    // multiplexes Lambda connections onto them. 100 Lambda invocations
    // might share 5 actual DB connections.
    //
    // iamAuth: true means Lambda authenticates to the proxy using its
    // IAM role — no password in Lambda code or environment variables.
    // ----------------------------------------------------------------
    this.dbProxy = new rds.DatabaseProxy(this, 'RdsProxy', {
      proxyTarget: rds.ProxyTarget.fromInstance(db),
      secrets: [this.dbSecret],
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [rdsProxySG],
      dbProxyName: 'united-portal-proxy',
      iamAuth: true,
      requireTLS: true,
    });

    // ----------------------------------------------------------------
    // Cognito User Pool
    //
    // A User Pool is a user directory. It stores credentials, handles
    // sign-up/sign-in flows, issues JWTs (ID token, access token,
    // refresh token), and integrates natively with AppSync for auth.
    //
    // We're using email as the sign-in identifier, which matches what
    // the original United Portal would have used (employee email).
    // ----------------------------------------------------------------
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'united-portal-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
        fullname: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ----------------------------------------------------------------
    // Cognito User Pool Client
    //
    // A User Pool Client represents an app (our React frontend) that
    // is allowed to authenticate against the User Pool.
    //
    // USER_SRP_AUTH: Secure Remote Password — the frontend never sends
    // the password to Cognito in plaintext. Amplify uses this by default.
    //
    // USER_PASSWORD_AUTH: Simpler flow, useful for testing with curl/Postman.
    //
    // No client secret: public clients (SPAs) can't keep secrets, so we
    // don't generate one. Server-side clients would have a secret.
    // ----------------------------------------------------------------
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'united-portal-web',
      authFlows: {
        userSrp: true,
        userPassword: true, // convenient for dev, disable in prod
      },
      generateSecret: false,
    });

    this.userPoolClientId = userPoolClient.userPoolClientId;

    // ----------------------------------------------------------------
    // Outputs
    //
    // CfnOutput makes these values visible in the AWS console under
    // CloudFormation → Stacks → Outputs, and in `cdk deploy` terminal
    // output. Useful for wiring things together manually if needed.
    // ----------------------------------------------------------------
    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClientId });
    new cdk.CfnOutput(this, 'DbProxyEndpoint', { value: this.dbProxy.endpoint });
  }
}
