import * as path from 'node:path';
import type { EnvName } from '@vozcoletiva/shared';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { EndpointType, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import type { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import type { Table } from 'aws-cdk-lib/aws-dynamodb';
import {
  Architecture,
  Code,
  Function as LambdaFunction,
  Runtime,
  Tracing,
} from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ApiProps {
  readonly env: EnvName;
  readonly table: Table;
  readonly userPool: UserPool;
  readonly userPoolClient: UserPoolClient;
}

/**
 * HTTP API Gateway fronting the Rust Lambda. For the foundation slice the
 * Lambda exposes one route (GET /v1/hello). Routes are added by appending to
 * the resource tree as features land.
 */
export class Api extends Construct {
  readonly url: string;
  readonly restApi: RestApi;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    // Path to the compiled Lambda bootstrap. cargo-lambda emits to
    // `target/lambda/voz-api/bootstrap`. The deploy script runs the build first.
    const lambdaArtifactPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'target',
      'lambda',
      'voz-api',
    );

    const logGroup = new LogGroup(this, 'LambdaLogs', {
      logGroupName: `/aws/lambda/voz-${props.env}-api`,
      retention: props.env === 'prod' ? RetentionDays.ONE_MONTH : RetentionDays.ONE_WEEK,
      removalPolicy: props.env === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    const fn = new LambdaFunction(this, 'HelloFn', {
      functionName: `voz-${props.env}-api`,
      runtime: Runtime.PROVIDED_AL2023,
      architecture: Architecture.ARM_64,
      handler: 'bootstrap',
      code: Code.fromAsset(lambdaArtifactPath),
      memorySize: 256,
      timeout: Duration.seconds(10),
      logGroup,
      tracing: Tracing.ACTIVE,
      environment: {
        TABLE_NAME: props.table.tableName,
        USER_POOL_ID: props.userPool.userPoolId,
        USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
        RUST_LOG: 'info',
      },
    });

    props.table.grantReadWriteData(fn);

    this.restApi = new RestApi(this, 'Rest', {
      restApiName: `voz-${props.env}-api`,
      deployOptions: {
        stageName: 'v1',
        tracingEnabled: true,
      },
      endpointTypes: [EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Mount the Lambda at every path under v1 so the handler can route.
    // The Rust handler matches "/v1/hello" — we strip the API GW stage
    // prefix on the client by calling `${api.url}hello`.
    const v1 = this.restApi.root.addResource('hello');
    v1.addMethod('GET', new LambdaIntegration(fn));

    this.url = this.restApi.url;
  }
}
