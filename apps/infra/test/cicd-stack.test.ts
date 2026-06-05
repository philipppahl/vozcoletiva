import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, it } from 'vitest';
import { CicdStack } from '../lib/cicd-stack';

describe('CicdStack', () => {
  function synth() {
    const app = new App();
    const stack = new CicdStack(app, 'voz-cicd', {
      env: { account: '130141755138', region: 'eu-west-1' },
      githubRepo: 'philipppahl/vozcoletiva',
      bootstrapRegions: ['eu-west-1', 'us-east-1'],
    });
    return Template.fromStack(stack);
  }

  it('creates one OIDC deploy role per environment', () => {
    const t = synth();
    t.resourceCountIs('AWS::IAM::Role', 2);
    t.hasResourceProperties('AWS::IAM::Role', { RoleName: 'vozcoletiva-deploy-dev' });
    t.hasResourceProperties('AWS::IAM::Role', { RoleName: 'vozcoletiva-deploy-prod' });
  });

  it('scopes each role trust to its GitHub Environment + the OIDC audience', () => {
    const t = synth();
    for (const env of ['dev', 'prod']) {
      t.hasResourceProperties('AWS::IAM::Role', {
        RoleName: `vozcoletiva-deploy-${env}`,
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sts:AssumeRoleWithWebIdentity',
              Condition: {
                StringEquals: {
                  'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                  'token.actions.githubusercontent.com:sub': `repo:philipppahl/vozcoletiva:environment:${env}`,
                },
              },
            }),
          ]),
        }),
      });
    }
  });

  it('permits only assuming the CDK bootstrap roles in the app + cert regions', () => {
    const t = synth();
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'sts:AssumeRole',
            Resource: [
              'arn:aws:iam::130141755138:role/cdk-hnb659fds-*-role-130141755138-eu-west-1',
              'arn:aws:iam::130141755138:role/cdk-hnb659fds-*-role-130141755138-us-east-1',
            ],
          }),
        ]),
      }),
    });
  });

  it('lets each role read only its own env stack outputs', () => {
    const t = synth();
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'cloudformation:DescribeStacks',
            Resource: 'arn:aws:cloudformation:eu-west-1:130141755138:stack/voz-dev/*',
          }),
        ]),
      }),
    });
  });
});
