import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { describe, it } from 'vitest';
import { getEnvConfig, stackNameFor } from '../lib/env-config';
import { VozStack } from '../lib/voz-stack';

describe('VozStack (dev)', () => {
  function synth() {
    const app = new App();
    const env = getEnvConfig('dev');
    const stack = new VozStack(app, stackNameFor('dev'), {
      envConfig: env,
      env: { account: env.account, region: env.region },
    });
    return Template.fromStack(stack);
  }

  it('creates the single DynamoDB table with PK/SK and three GSIs', () => {
    const t = synth();

    t.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'vozcoletiva-dev',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({ IndexName: 'GSI1' }),
        Match.objectLike({ IndexName: 'GSI2' }),
        Match.objectLike({ IndexName: 'GSI3' }),
      ]),
    });
  });

  it('creates a Cognito User Pool with email sign-in', () => {
    const t = synth();
    t.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'voz-dev-users',
      UsernameAttributes: ['email'],
    });
  });

  it('creates an API Gateway REST API with a proxy resource', () => {
    const t = synth();
    t.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'voz-dev-api',
    });
    t.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: '{proxy+}',
    });
  });

  it('creates an S3 bucket and CloudFront distribution for the PWA', () => {
    const t = synth();
    t.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'voz-dev-web-130141755138-eu-west-1',
    });
    // The PWA distribution is the one with the SPA fallback (the Media construct
    // also has a distribution, so match on the index.html error rewrites).
    t.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: 'index.html',
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({ ErrorCode: 403, ResponseCode: 200, ResponsePagePath: '/index.html' }),
        ]),
      }),
    });
  });

  it('leaves the distribution cert-less and without alias records when no cert is provided', () => {
    // synth() passes no certificate, so the custom-domain wiring must be skipped
    // even though dev's envConfig has a customDomain — a domainName without its
    // us-east-1 cert would be rejected at deploy.
    const t = synth();
    t.resourceCountIs('AWS::Route53::RecordSet', 0);
    t.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({ Aliases: Match.absent() }),
    });
  });

  it('wires the custom domain, cert, and A/AAAA alias records when a cert is provided', () => {
    const app = new App();
    const env = getEnvConfig('dev');
    // Import an existing cert ARN to stand in for the cross-region CertStack.
    const certScope = new Stack(app, 'cert-scope', {
      env: { account: env.account, region: 'us-east-1' },
    });
    const certificate = Certificate.fromCertificateArn(
      certScope,
      'Cert',
      `arn:aws:acm:us-east-1:${env.account}:certificate/00000000-0000-0000-0000-000000000000`,
    );
    const stack = new VozStack(app, stackNameFor('dev'), {
      envConfig: env,
      certificate,
      crossRegionReferences: true,
      env: { account: env.account, region: env.region },
    });
    const t = Template.fromStack(stack);
    t.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({ Aliases: ['dev.vozcoletiva.com'] }),
    });
    // One A + one AAAA alias pointing at CloudFront.
    t.resourceCountIs('AWS::Route53::RecordSet', 2);
    t.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'dev.vozcoletiva.com.',
      Type: 'A',
    });
    t.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'dev.vozcoletiva.com.',
      Type: 'AAAA',
    });
  });

  it('provisions an API Lambda + a worker Lambda', () => {
    const t = synth();
    t.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'voz-dev-api',
    });
    t.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'voz-dev-worker',
    });
  });

  it('creates the EventBridge schedule group + invoke role', () => {
    const t = synth();
    t.hasResourceProperties('AWS::Scheduler::ScheduleGroup', {
      Name: 'voz-dev',
    });
    t.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'voz-dev-scheduler-invoke',
    });
  });

  it('outputs the API URL, web URL, table name, and Cognito IDs', () => {
    const t = synth();
    t.hasOutput('ApiUrl', {});
    t.hasOutput('WebUrl', {});
    t.hasOutput('TableName', {});
    t.hasOutput('UserPoolId', {});
    t.hasOutput('UserPoolClientId', {});
  });
});
