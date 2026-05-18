import * as path from 'node:path';
import type { EnvName } from '@vozcoletiva/shared';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { EndpointType, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import type { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import type { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import {
  Architecture,
  Code,
  Function as LambdaFunction,
  Runtime,
  Tracing,
} from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnScheduleGroup } from 'aws-cdk-lib/aws-scheduler';
import { Construct } from 'constructs';

export interface ApiProps {
  readonly env: EnvName;
  readonly table: Table;
  readonly userPool: UserPool;
  readonly userPoolClient: UserPoolClient;
}

/**
 * HTTP API Gateway fronting the Rust Lambda + a sibling worker Lambda invoked
 * by EventBridge Scheduler at proposal close-time.
 */
export class Api extends Construct {
  readonly url: string;
  readonly restApi: RestApi;
  readonly workerFunctionArn: string;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    const apiArtifactPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'target',
      'lambda',
      'voz-api',
    );
    const workerArtifactPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'target',
      'lambda',
      'voz-worker',
    );

    // --- Scheduler group ---------------------------------------------------
    const scheduleGroupName = `voz-${props.env}`;
    new CfnScheduleGroup(this, 'ScheduleGroup', {
      name: scheduleGroupName,
    });

    // --- Worker Lambda -----------------------------------------------------
    const workerLogGroup = new LogGroup(this, 'WorkerLogs', {
      logGroupName: `/aws/lambda/voz-${props.env}-worker`,
      retention: props.env === 'prod' ? RetentionDays.ONE_MONTH : RetentionDays.ONE_WEEK,
      removalPolicy: props.env === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    const workerFn = new LambdaFunction(this, 'WorkerFn', {
      functionName: `voz-${props.env}-worker`,
      runtime: Runtime.PROVIDED_AL2023,
      architecture: Architecture.ARM_64,
      handler: 'bootstrap',
      code: Code.fromAsset(workerArtifactPath),
      memorySize: 256,
      timeout: Duration.seconds(15),
      logGroup: workerLogGroup,
      tracing: Tracing.ACTIVE,
      environment: {
        TABLE_NAME: props.table.tableName,
        USER_POOL_ID: props.userPool.userPoolId,
        USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
        RUST_LOG: 'info',
      },
    });
    props.table.grantReadWriteData(workerFn);

    // --- Scheduler invoke role --------------------------------------------
    const schedulerInvokeRole = new Role(this, 'SchedulerInvokeRole', {
      roleName: `voz-${props.env}-scheduler-invoke`,
      assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
    });
    schedulerInvokeRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [workerFn.functionArn],
      }),
    );

    // --- API Lambda --------------------------------------------------------
    const apiLogGroup = new LogGroup(this, 'LambdaLogs', {
      logGroupName: `/aws/lambda/voz-${props.env}-api`,
      retention: props.env === 'prod' ? RetentionDays.ONE_MONTH : RetentionDays.ONE_WEEK,
      removalPolicy: props.env === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    const fn = new LambdaFunction(this, 'HelloFn', {
      functionName: `voz-${props.env}-api`,
      runtime: Runtime.PROVIDED_AL2023,
      architecture: Architecture.ARM_64,
      handler: 'bootstrap',
      code: Code.fromAsset(apiArtifactPath),
      memorySize: 256,
      timeout: Duration.seconds(10),
      logGroup: apiLogGroup,
      tracing: Tracing.ACTIVE,
      environment: {
        TABLE_NAME: props.table.tableName,
        USER_POOL_ID: props.userPool.userPoolId,
        USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
        SCHEDULER_GROUP_NAME: scheduleGroupName,
        WORKER_FUNCTION_ARN: workerFn.functionArn,
        SCHEDULER_INVOKE_ROLE_ARN: schedulerInvokeRole.roleArn,
        RUST_LOG: 'info',
      },
    });

    props.table.grantReadWriteData(fn);

    // Scheduler permissions, scoped to this env's schedule group.
    const region = Stack.of(this).region;
    const account = Stack.of(this).account;
    const scheduleArnPrefix = `arn:aws:scheduler:${region}:${account}:schedule/${scheduleGroupName}/*`;
    fn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'scheduler:CreateSchedule',
          'scheduler:UpdateSchedule',
          'scheduler:DeleteSchedule',
          'scheduler:GetSchedule',
        ],
        resources: [scheduleArnPrefix],
      }),
    );
    // PassRole so the API can pin the scheduler-invoke role onto schedules
    // it creates.
    fn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iam:PassRole'],
        resources: [schedulerInvokeRole.roleArn],
        conditions: {
          StringEquals: { 'iam:PassedToService': 'scheduler.amazonaws.com' },
        },
      }),
    );

    // --- REST API ---------------------------------------------------------
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

    this.restApi.root.addProxy({
      anyMethod: true,
      defaultIntegration: new LambdaIntegration(fn),
    });

    this.url = this.restApi.url;
    this.workerFunctionArn = workerFn.functionArn;
  }
}
