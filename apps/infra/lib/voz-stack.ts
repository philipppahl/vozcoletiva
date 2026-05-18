import type { StackProps } from 'aws-cdk-lib';
import { CfnOutput, Stack, Tags } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

import { Api } from './constructs/api';
import { Auth } from './constructs/auth';
import { DataTable } from './constructs/data-table';
import { WebHosting } from './constructs/web-hosting';
import type { EnvConfig } from './env-config';

export interface VozStackProps extends StackProps {
  readonly envConfig: EnvConfig;
}

export class VozStack extends Stack {
  constructor(scope: Construct, id: string, props: VozStackProps) {
    super(scope, id, props);

    const { envConfig } = props;

    const data = new DataTable(this, 'Data', { env: envConfig.env });
    const auth = new Auth(this, 'Auth', { env: envConfig.env });
    const api = new Api(this, 'Api', {
      env: envConfig.env,
      table: data.table,
      userPool: auth.userPool,
      userPoolClient: auth.webClient,
    });
    const web = new WebHosting(this, 'Web', { env: envConfig.env });

    Tags.of(this).add('Project', 'vozcoletiva');
    Tags.of(this).add('Env', envConfig.env);

    new CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'HTTP API base URL',
    });
    new CfnOutput(this, 'WebUrl', {
      value: `https://${web.distribution.distributionDomainName}`,
      description: 'CloudFront URL for the PWA',
    });
    new CfnOutput(this, 'WebBucketName', {
      value: web.bucket.bucketName,
      description: 'S3 bucket name for the PWA build artefacts',
    });
    new CfnOutput(this, 'UserPoolId', {
      value: auth.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });
    new CfnOutput(this, 'UserPoolClientId', {
      value: auth.webClient.userPoolClientId,
      description: 'Cognito User Pool web client ID',
    });
    new CfnOutput(this, 'TableName', {
      value: data.table.tableName,
      description: 'DynamoDB single-table name',
    });
  }
}
