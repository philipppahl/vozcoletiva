#!/usr/bin/env bun
/**
 * Regenerate `src/generated/schema.ts` from the OpenAPI spec at
 * `apps/api/openapi.yaml`.
 *
 * Modes:
 *  - default     — write the regenerated file to disk.
 *  - --verify    — compare what would be generated against what is committed
 *                  and exit non-zero if they differ. Used in CI stage 1 to
 *                  catch stale `api-client` commits.
 *
 * Codegen output must be deterministic (sorted, stable formatting). The
 * verify mode is the contract that the codegen + spec stay in sync.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const SPEC_PATH = resolve(ROOT, 'apps/api/openapi.yaml');
const OUT_PATH = resolve(HERE, '..', 'src/generated/schema.ts');

const HEADER = `/* eslint-disable */
// AUTO-GENERATED from apps/api/openapi.yaml — do not edit by hand.
// Regenerate with: bun run api:generate

`;

async function generate(): Promise<string> {
  const specUrl = new URL(`file://${SPEC_PATH}`);
  const ast = await openapiTS(specUrl, {
    alphabetize: true,
    immutable: false,
  });
  return HEADER + astToString(ast);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const verifyOnly = args.has('--verify');

  const generated = await generate();

  if (verifyOnly) {
    let committed: string | null;
    try {
      committed = await readFile(OUT_PATH, 'utf8');
    } catch {
      committed = null;
    }
    if (committed === generated) {
      console.log('✓ api-client/src/generated/schema.ts is up to date');
      return;
    }
    console.error(
      '✗ api-client/src/generated/schema.ts is OUT OF DATE\n' +
        '  Run: bun run api:generate, then commit the change.',
    );
    process.exit(1);
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, generated, 'utf8');
  console.log(`✓ wrote ${OUT_PATH}`);
}

await main();
