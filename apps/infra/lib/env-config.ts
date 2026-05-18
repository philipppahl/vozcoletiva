import type { EnvName } from '@vozcoletiva/shared';

export interface EnvConfig {
  readonly env: EnvName;
  readonly account: string;
  readonly region: string;
  /** GitHub repo `owner/name` used for OIDC trust on deploy roles. */
  readonly githubRepo: string;
  /** Set to `null` until vozcoletiva.com is registered and DNS is wired. */
  readonly customDomain: string | null;
}

const COMMON = {
  account: '130141755138',
  region: 'eu-west-1',
  // TODO(repo): replace with the real `owner/name` once the GH repo is created.
  githubRepo: 'philipppahl/vozcoletiva',
} as const;

const CONFIGS: Record<EnvName, EnvConfig> = {
  dev: {
    ...COMMON,
    env: 'dev',
    customDomain: null,
  },
  prod: {
    ...COMMON,
    env: 'prod',
    customDomain: null,
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
