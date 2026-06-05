#!/usr/bin/env bun
import type { EnvName } from '@vozcoletiva/shared';
import { App } from 'aws-cdk-lib';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';

import { CicdStack } from '../lib/cicd-stack';
import { CertStack } from '../lib/constructs/dns-cert';
import { getEnvConfig, stackNameFor } from '../lib/env-config';
import { VozStack } from '../lib/voz-stack';

const app = new App();

if (process.env.VOZ_TARGET === 'cicd') {
  // Account-level CI/CD OIDC deploy roles (decision 0037). Not env-specific and a
  // bootstrap dependency, so its own stack, deployed manually: `deploy --cicd`.
  const cfg = getEnvConfig('dev'); // account/region/repo are shared across envs
  new CicdStack(app, 'voz-cicd', {
    env: { account: cfg.account, region: cfg.region },
    description: 'vozcoletiva CI/CD — GitHub Actions OIDC deploy roles',
    githubRepo: cfg.githubRepo,
    // App stacks live in eu-west-1; the CloudFront cert stack in us-east-1.
    bootstrapRegions: [cfg.region, 'us-east-1'],
  });
} else {
  const envName = (process.env.VOZ_ENV ?? 'dev') as EnvName;
  if (envName !== 'dev' && envName !== 'prod') {
    console.error(`VOZ_ENV must be 'dev' or 'prod', got: ${envName}`);
    process.exit(1);
  }

  const envConfig = getEnvConfig(envName);

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
}
