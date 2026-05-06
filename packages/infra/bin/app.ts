#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FoundationStack } from '../lib/stacks/foundation-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';

const app = new cdk.App();

// env pulls your default AWS account and region from the CLI profile.
// This means `cdk deploy` will target whatever account `aws configure` points to.
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

const foundation = new FoundationStack(app, 'UnitedPortal-Foundation', { env });

// ApiStack receives outputs from FoundationStack as constructor props.
// This is how CDK models cross-stack dependencies — no hardcoded ARNs.
const api = new ApiStack(app, 'UnitedPortal-Api', {
  env,
  userPool: foundation.userPool,
  dbProxy: foundation.dbProxy,
  dbSecret: foundation.dbSecret,
  lambdaSecurityGroup: foundation.lambdaSecurityGroup,
  vpc: foundation.vpc,
});

// FrontendStack receives the AppSync URL so it can be injected into the React build.
new FrontendStack(app, 'UnitedPortal-Frontend', {
  env,
  graphqlUrl: api.graphqlUrl,
  userPoolId: foundation.userPool.userPoolId,
  userPoolClientId: foundation.userPoolClientId,
});
