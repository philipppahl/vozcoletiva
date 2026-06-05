import type { EnvName } from '@vozcoletiva/shared';

export interface EnvConfig {
  readonly env: EnvName;
  readonly account: string;
  readonly region: string;
  /** GitHub repo `owner/name` used for OIDC trust on deploy roles. */
  readonly githubRepo: string;
  /** Hostname this env's PWA is served on, or `null` to use the raw
   *  *.cloudfront.net domain. dev → dev.vozcoletiva.com; the apex is reserved
   *  for prod (wired in Phase 2). See docs/decisions/0036. */
  readonly customDomain: string | null;
  /** Route 53 hosted zone for vozcoletiva.com (shared across envs). Null only
   *  if the domain isn't registered. */
  readonly hostedZoneId: string | null;
  readonly zoneName: string | null;
}

const COMMON = {
  account: '130141755138',
  region: 'eu-west-1',
  githubRepo: 'philipppahl/vozcoletiva',
  // vozcoletiva.com hosted zone, created on registration (decision 0036).
  hostedZoneId: 'Z0669703GLJFF9CB3PZR',
  zoneName: 'vozcoletiva.com',
} as const;

const CONFIGS: Record<EnvName, EnvConfig> = {
  dev: {
    ...COMMON,
    env: 'dev',
    customDomain: 'dev.vozcoletiva.com',
  },
  prod: {
    ...COMMON,
    env: 'prod',
    // Apex → prod (decision 0036). www → apex redirect is a follow-up.
    customDomain: 'vozcoletiva.com',
  },
};

export function getEnvConfig(env: EnvName): EnvConfig {
  const cfg = CONFIGS[env];
  if (!cfg) {
    throw new Error(`Unknown env: ${env}`);
  }
  return cfg;
}

export function stackNameFor(env: EnvName): string {
  return `voz-${env}`;
}
