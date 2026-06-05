import type { StackProps } from 'aws-cdk-lib';
import { Duration, Stack } from 'aws-cdk-lib';
import {
  Effect,
  OpenIdConnectPrincipal,
  OpenIdConnectProvider,
  PolicyStatement,
  Role,
} from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface CicdStackProps extends StackProps {
  /** GitHub `owner/name` the deploy roles trust. */
  readonly githubRepo: string;
  /** Regions whose CDK bootstrap roles a deploy may assume (app + cert). */
  readonly bootstrapRegions: string[];
}

const OIDC_HOST = 'token.actions.githubusercontent.com';
/** Default CDK bootstrap qualifier (this account is bootstrapped with it). */
const CDK_QUALIFIER = 'hnb659fds';

/**
 * GitHub Actions OIDC deploy roles (decision 0037) — one per environment.
 *
 * Each role trusts the existing GitHub OIDC provider, scoped to a specific
 * GitHub Environment (`environment:dev` / `environment:prod` — the deploy
 * workflow runs each job under those environments), and is permitted ONLY to
 * assume this account's CDK bootstrap roles. That makes the role least-privilege
 * at the GitHub-exposed surface: a leaked OIDC token can kick off a `cdk deploy`
 * and nothing else in the account. (Tightening the CDK cfn-exec role and
 * separating dev/prod at the resource level are documented follow-ups.)
 *
 * Account-level + a bootstrap dependency, so it lives in its own stack and is
 * deployed once, manually, with admin creds: `bun run deploy --cicd`.
 */
export class CicdStack extends Stack {
  constructor(scope: Construct, id: string, props: CicdStackProps) {
    super(scope, id, props);

    const provider = OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GitHubOidc',
      `arn:aws:iam::${this.account}:oidc-provider/${OIDC_HOST}`,
    );

    // The CDK bootstrap roles a deploy assumes (deploy / file-publishing /
    // image-publishing / lookup) across the regions our stacks span.
    const bootstrapRoleArns = props.bootstrapRegions.map(
      (r) => `arn:aws:iam::${this.account}:role/cdk-${CDK_QUALIFIER}-*-role-${this.account}-${r}`,
    );

    for (const env of ['dev', 'prod'] as const) {
      const role = new Role(this, env === 'dev' ? 'DeployDevRole' : 'DeployProdRole', {
        roleName: `vozcoletiva-deploy-${env}`,
        description: `GitHub Actions OIDC deploy role for ${env} (decision 0037)`,
        maxSessionDuration: Duration.hours(1),
        assumedBy: new OpenIdConnectPrincipal(provider, {
          StringEquals: {
            [`${OIDC_HOST}:aud`]: 'sts.amazonaws.com',
            [`${OIDC_HOST}:sub`]: `repo:${props.githubRepo}:environment:${env}`,
          },
        }),
      });
      role.addToPolicy(
        new PolicyStatement({
          sid: 'AssumeCdkBootstrapRoles',
          effect: Effect.ALLOW,
          actions: ['sts:AssumeRole'],
          resources: bootstrapRoleArns,
        }),
      );
    }
  }
}
