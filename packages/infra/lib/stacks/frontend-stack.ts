import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

interface FrontendStackProps extends cdk.StackProps {
  graphqlUrl: string;
  userPoolId: string;
  userPoolClientId: string;
}

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    // ----------------------------------------------------------------
    // S3 bucket
    //
    // The bucket is fully private — no public access at all.
    // CloudFront is the only entity that can read from it, which it
    // does via Origin Access Control (OAC). OAC replaces the older
    // Origin Access Identity (OAI) approach and is AWS's current
    // recommendation. CDK wires the bucket policy automatically when
    // you use S3BucketOrigin.withOriginAccessControl().
    //
    // autoDeleteObjects + DESTROY: CDK deploys a Lambda to empty the
    // bucket before CloudFormation deletes it. Without this, the delete
    // would fail if the bucket isn't empty.
    // ----------------------------------------------------------------
    const bucket = new s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ----------------------------------------------------------------
    // CloudFront distribution
    //
    // Why CloudFront in front of S3 rather than S3 static website hosting?
    // - HTTPS by default (S3 website hosting is HTTP only)
    // - Edge caching reduces latency globally
    // - OAC means the bucket never needs to be public
    // - We can add WAF, custom domains, etc. later without changing the app
    //
    // SPA routing: React Router handles paths client-side (e.g. /tickets/123),
    // but those paths don't exist as S3 objects. Without the errorResponses
    // override, CloudFront would return a 403 or 404 for any deep link.
    // Returning index.html with a 200 lets React Router take over.
    //
    // REDIRECT_TO_HTTPS: any HTTP request is permanently redirected to HTTPS.
    // ----------------------------------------------------------------
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // ----------------------------------------------------------------
    // BucketDeployment
    //
    // Uploads the Vite build output (packages/frontend/dist/) to S3,
    // then invalidates the CloudFront cache so the new version is
    // served immediately instead of waiting for the TTL to expire.
    //
    // IMPORTANT: run `npm run build --workspace=packages/frontend` before
    // `cdk deploy` — CDK reads the already-built dist/ at synth time.
    // ----------------------------------------------------------------
    new s3deploy.BucketDeployment(this, 'Deploy', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../../../frontend/dist')),
      ],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    new cdk.CfnOutput(this, 'Url', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront URL for the United Portal frontend',
    });
  }
}
