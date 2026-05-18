#!/usr/bin/env bun
import type { EnvName } from '@vozcoletiva/shared';
import { App } from 'aws-cdk-lib';

import { getEnvConfig, stackNameFor } from '../lib/env-config';
import { VozStack } from '../lib/voz-stack';

const envName = (process.env.VOZ_ENV ?? 'dev') as EnvName;
if (envName !== 'dev' && envName !== 'prod') {
  console.error(`VOZ_ENV must be 'dev' or 'prod', got: ${envName}`);
  process.exit(1);
}

const envConfig = getEnvConfig(envName);

const app = new App();

new VozStack(app, stackNameFor(envName), {
  envConfig,
  env: { account: envConfig.account, region: envConfig.region },
  description: `vozcoletiva ${envName} stack`,
});
