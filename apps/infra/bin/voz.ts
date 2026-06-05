#!/usr/bin/env bun
import type { EnvName } from '@vozcoletiva/shared';
import { App } from 'aws-cdk-lib';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';

import { CertStack } from '../lib/constructs/dns-cert';
import { getEnvConfig, stackNameFor } from '../lib/env-config';
import { VozStack } from '../lib/voz-stack';

const envName = (process.env.VOZ_ENV ?? 'dev') as EnvName;
if (envName !== 'dev' && envName !== 'prod') {
  console.error(`VOZ_ENV must be 'dev' or 'prod', got: ${envName}`);
  process.exit(1);
}

const envConfig = getEnvConfig(envName);

const app = new App();

// CloudFront needs its cert in us-east-1; the app stack is in eu-west-1. When
// the env has a custom domain, stand the cert up in its own us-east-1 stack and
// pass it across via crossRegionReferences (decision 0036).
let certificate: ICertificate | undefined;
if (envConfig.customDomain && envConfig.hostedZoneId && envConfig.zoneName) {
  const certStack = new CertStack(app, `${stackNameFor(envName)}-cert`, {
    env: { account: envConfig.account, region: 'us-east-1' },
    crossRegionReferences: true,
    description: `vozcoletiva ${envName} CloudFront cert (us-east-1)`,
    domainName: envConfig.customDomain,
    hostedZoneId: envConfig.hostedZoneId,
    zoneName: envConfig.zoneName,
  });
  certificate = certStack.certificate;
}

new VozStack(app, stackNameFor(envName), {
  envConfig,
  certificate,
  crossRegionReferences: true,
  env: { account: envConfig.account, region: envConfig.region },
  description: `vozcoletiva ${envName} stack`,
});
