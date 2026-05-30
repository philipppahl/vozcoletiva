import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
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
    t.resourceCountIs('AWS::S3::Bucket', 1);
    t.resourceCountIs('AWS::CloudFront::Distribution', 1);
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
