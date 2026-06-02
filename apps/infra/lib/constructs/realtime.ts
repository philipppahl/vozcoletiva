import * as path from 'node:path';
import type { EnvName } from '@vozcoletiva/shared';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { WebSocketApi, WebSocketStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { WebSocketLambdaAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import type { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import {
  Architecture,
  Code,
  FilterCriteria,
  FilterRule,
  Function as LambdaFunction,
  Runtime,
  StartingPosition,
  Tracing,
} from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface RealtimeProps {
  readonly env: EnvName;
  /** The single table — must have a stream enabled (NEW_IMAGE). */
  readonly table: Table;
  readonly userPool: UserPool;
  readonly userPoolClient: UserPoolClient;
}

const ARTIFACT_ROOT = path.resolve(__dirname, '..', '..', '..', '..', 'target', 'lambda');

/**
 * Real-time delivery (decision 0028 + 0025 Phase B):
 *
 *   • A WebSocket API (`$connect`/`$disconnect`/`$default`) backed by the
 *     `voz-ws` Lambda, with a Lambda REQUEST authorizer that verifies the
 *     Cognito access token passed as `?token=` on the handshake.
 *   • A `voz-realtime` Lambda on the table's DynamoDB stream that broadcasts new
 *     messages to open sockets (`PostToConnection`) and sends Web Push for inbox
 *     items + DMs.
 */
export class Realtime extends Construct {
  /** `wss://…` base URL for the FE to open the socket. */
  readonly wsUrl: string;

  constructor(scope: Construct, id: string, props: RealtimeProps) {
    super(scope, id);

    const region = Stack.of(this).region;
    const account = Stack.of(this).account;
    const retention =
      props.env === 'prod' ? RetentionDays.ONE_MONTH : RetentionDays.ONE_WEEK;
    const removalPolicy =
      props.env === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;
    const commonEnv = {
      TABLE_NAME: props.table.tableName,
      USER_POOL_ID: props.userPool.userPoolId,
      USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
      RUST_LOG: 'info',
    };

    // --- voz-ws Lambda (connect/disconnect/default + authorizer) -----------
    const wsFn = new LambdaFunction(this, 'WsFn', {
      functionName: `voz-${props.env}-ws`,
      runtime: Runtime.PROVIDED_AL2023,
      architecture: Architecture.ARM_64,
      handler: 'bootstrap',
      code: Code.fromAsset(path.join(ARTIFACT_ROOT, 'voz-ws')),
      memorySize: 256,
      timeout: Duration.seconds(10),
      logGroup: new LogGroup(this, 'WsLogs', {
        logGroupName: `/aws/lambda/voz-${props.env}-ws`,
        retention,
        removalPolicy,
      }),
      tracing: Tracing.ACTIVE,
      environment: commonEnv,
    });
    props.table.grantReadWriteData(wsFn);

    // --- WebSocket API -----------------------------------------------------
    const authorizer = new WebSocketLambdaAuthorizer('WsAuthorizer', wsFn, {
      // Browsers can't set headers on a WS upgrade, so the token rides in the
      // query string. The authorizer caches per distinct token.
      identitySource: ['route.request.querystring.token'],
    });
    const wsApi = new WebSocketApi(this, 'WsApi', {
      apiName: `voz-${props.env}-ws`,
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration('ConnectInteg', wsFn),
        authorizer,
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration('DisconnectInteg', wsFn),
      },
      defaultRouteOptions: {
        integration: new WebSocketLambdaIntegration('DefaultInteg', wsFn),
      },
    });
    const stage = new WebSocketStage(this, 'WsStage', {
      webSocketApi: wsApi,
      stageName: 'v1',
      autoDeploy: true,
    });
    this.wsUrl = stage.url; // wss://<id>.execute-api.<region>.amazonaws.com/v1

    // --- voz-realtime Lambda (stream consumer) -----------------------------
    // PostToConnection target — the Management API endpoint for this stage.
    const wsCallbackUrl = `https://${wsApi.apiId}.execute-api.${region}.amazonaws.com/${stage.stageName}`;
    const realtimeFn = new LambdaFunction(this, 'RealtimeFn', {
      functionName: `voz-${props.env}-realtime`,
      runtime: Runtime.PROVIDED_AL2023,
      architecture: Architecture.ARM_64,
      handler: 'bootstrap',
      code: Code.fromAsset(path.join(ARTIFACT_ROOT, 'voz-realtime')),
      memorySize: 256,
      timeout: Duration.seconds(30),
      logGroup: new LogGroup(this, 'RealtimeLogs', {
        logGroupName: `/aws/lambda/voz-${props.env}-realtime`,
        retention,
        removalPolicy,
      }),
      tracing: Tracing.ACTIVE,
      environment: {
        ...commonEnv,
        WS_ENDPOINT: wsCallbackUrl,
        // Web Push (0025 Phase B). The private key is an SSM SecureString,
        // fetched at cold start; the subject is the RFC 8292 contact.
        VAPID_SUBJECT: 'mailto:ph.pahl@gmail.com',
        VAPID_PRIVATE_KEY_PARAM: `/voz/${props.env}/vapid-private-key`,
      },
    });
    props.table.grantReadWriteData(realtimeFn);
    // Push messages to open sockets + drop dead ones.
    wsApi.grantManageConnections(realtimeFn);
    // Read the VAPID private key (Web Push signing).
    realtimeFn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['ssm:GetParameter'],
        resources: [
          `arn:aws:ssm:${region}:${account}:parameter/voz/${props.env}/vapid-private-key`,
        ],
      }),
    );
    // Consume the table stream — only INSERTs (new message / inbox item).
    realtimeFn.addEventSource(
      new DynamoEventSource(props.table, {
        startingPosition: StartingPosition.LATEST,
        batchSize: 10,
        retryAttempts: 2,
        bisectBatchOnError: true,
        filters: [
          FilterCriteria.filter({ eventName: FilterRule.isEqual('INSERT') }),
        ],
      }),
    );
  }
}
