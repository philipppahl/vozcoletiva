import * as fs from 'node:fs';
import * as path from 'node:path';
import { Code } from 'aws-cdk-lib/aws-lambda';

const ARTIFACT_ROOT = path.resolve(__dirname, '..', '..', '..', '..', 'target', 'lambda');
const PLACEHOLDER = path.resolve(__dirname, '..', '..', 'lambda-placeholder');

/**
 * Lambda code from the cargo-lambda build output (`target/lambda/<bin>`).
 *
 * The deploy script always builds these first and refuses to deploy if a
 * `bootstrap` is missing, so a real deploy always ships the real binary. When
 * the artifact is absent — `cdk synth`/`diff` and the infra unit tests, which
 * never deploy — fall back to a committed placeholder so synth still succeeds.
 * This mirrors the web-dist guard in `web-hosting.ts` and keeps the infra tests
 * hermetic (no dependency on a prior Rust build).
 */
export function lambdaCode(bin: string): Code {
  const dir = path.join(ARTIFACT_ROOT, bin);
  return Code.fromAsset(fs.existsSync(path.join(dir, 'bootstrap')) ? dir : PLACEHOLDER);
}
