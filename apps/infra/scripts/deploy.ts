#!/usr/bin/env bun
/**
 * Deploy vozcoletiva to AWS.
 *
 *   bun run deploy --env dev               # local dev deploy
 *   bun run deploy --env prod              # refuses unless GITHUB_ACTIONS=true
 *   bun run deploy --env dev --dry-run     # cdk diff only
 *
 * Guards:
 *   1. --env arg required, dev or prod.
 *   2. Working tree must be on `main`.
 *   3. Working tree must be clean.
 *   4. --env prod refuses outside GitHub Actions (override with VOZ_FORCE_PROD_DEPLOY=1).
 *
 * Pipeline:
 *   1. Build the Rust Lambda via cargo-lambda (arm64, release).
 *   2. Build the web app via `bun --filter @vozcoletiva/web run build`.
 *   3. `cdk deploy` (BucketDeployment uploads the web dist + invalidates CloudFront).
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

interface Args {
  env: 'dev' | 'prod';
  dryRun: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let env: string | undefined;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--env') {
      env = argv[++i];
    } else if (a?.startsWith('--env=')) {
      env = a.split('=')[1];
    } else if (a === '--dry-run') {
      dryRun = true;
    }
  }
  if (env !== 'dev' && env !== 'prod') {
    die('usage: deploy --env <dev|prod> [--dry-run]');
  }
  return { env, dryRun };
}

function die(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function run(cmd: string, opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  console.log(`\n$ ${cmd}`);
  const r = spawnSync(cmd, {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    stdio: 'inherit',
    shell: true,
  });
  if (r.status !== 0) {
    die(`command failed (exit ${r.status}): ${cmd}`);
  }
}

function checkBranch() {
  const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  if (branch !== 'main') {
    die(`must deploy from 'main' (currently on '${branch}')`);
  }
}

function checkCleanTree() {
  const status = execSync('git status --porcelain').toString().trim();
  if (status) {
    die(`working tree not clean:\n${status}`);
  }
}

function checkProdGuard(env: 'dev' | 'prod') {
  if (env !== 'prod') return;
  const inGhActions = process.env.GITHUB_ACTIONS === 'true';
  const breakGlass = process.env.VOZ_FORCE_PROD_DEPLOY === '1';
  if (inGhActions) return;
  if (breakGlass) {
    console.warn('\n⚠ BREAK-GLASS PROD DEPLOY: deploying prod from a developer machine.');
    console.warn('   Log this to the audit trail and announce in writing.');
    return;
  }
  die(
    "refusing to deploy '--env prod' from a developer machine.\n" +
      "  Prod deploys land via the GitHub Actions workflow on push to 'main'.\n" +
      '  Break-glass: set VOZ_FORCE_PROD_DEPLOY=1 (and log it).',
  );
}

async function main() {
  const args = parseArgs();
  const root = resolve(HERE, '..', '..', '..');

  if (!args.dryRun) {
    checkBranch();
    checkCleanTree();
  }
  checkProdGuard(args.env);

  console.log(`\n=== vozcoletiva deploy → ${args.env}${args.dryRun ? ' (dry-run)' : ''} ===`);

  // 1. Build Rust Lambda. cargo-lambda is smart about incremental compilation;
  // always invoking it is fine and avoids stale-artifact pitfalls.
  console.log('\n• building Rust Lambda (cargo lambda build --release --arm64)…');
  const probe = spawnSync('cargo lambda --version', { shell: true });
  if (probe.status !== 0) {
    console.error(
      '\n✗ cargo-lambda is not installed. Install it once:\n' +
        '    cargo install cargo-lambda\n' +
        '  Then re-run this command.',
    );
    process.exit(1);
  }
  run('cargo lambda build --release --arm64 -p voz-api', { cwd: root });
  if (!existsSync(resolve(root, 'target/lambda/voz-api/bootstrap'))) {
    die('Lambda build did not produce target/lambda/voz-api/bootstrap');
  }

  // 2. Build web app.
  console.log('\n• building web app…');
  run('bun run build', { cwd: resolve(root, 'apps/web') });

  // 3. CDK deploy (or diff).
  const cdkEnv = { VOZ_ENV: args.env };
  if (args.dryRun) {
    run(`bunx cdk diff '${stackName(args.env)}'`, {
      cwd: resolve(root, 'apps/infra'),
      env: cdkEnv,
    });
  } else {
    run(`bunx cdk deploy '${stackName(args.env)}' --require-approval never`, {
      cwd: resolve(root, 'apps/infra'),
      env: cdkEnv,
    });
  }

  console.log('\n✓ deploy complete');
}

function stackName(env: 'dev' | 'prod'): string {
  return `voz-${env}`;
}

await main();
