import type { EnvName } from '@vozcoletiva/shared';
import { RemovalPolicy } from 'aws-cdk-lib';
import {
  AccountRecovery,
  UserPool,
  UserPoolClient,
  VerificationEmailStyle,
} from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthProps {
  readonly env: EnvName;
}

/**
 * Cognito User Pool for email-based sign-up. The auth flow itself lands in
 * the auth feature slice — for the foundation we just create the pool + a
 * web client so downstream stacks have something to wire against.
 */
export class Auth extends Construct {
  readonly userPool: UserPool;
  readonly webClient: UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthProps) {
    super(scope, id);

    this.userPool = new UserPool(this, 'UserPool', {
      userPoolName: `voz-${props.env}-users`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      userVerification: {
        emailStyle: VerificationEmailStyle.CODE,
        emailSubject: 'Verify your vozcoletiva account',
      },
      removalPolicy: props.env === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    this.webClient = new UserPoolClient(this, 'WebClient', {
      userPool: this.userPool,
      userPoolClientName: `voz-${props.env}-web`,
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
      accessTokenValidity: undefined,
      refreshTokenValidity: undefined,
    });
  }
}
