#!/usr/bin/env bun
/**
 * One-off, NON-DESTRUCTIVE: assign @handles to the existing dev demo users via
 * the public API (`PUT /v1/me/handle`). Unlike `seed-dev.ts` this does NOT wipe
 * the table — it leaves projects, messages, DMs, and push subscriptions intact.
 * Used to migrate legacy accounts after the handles deploy (decision 0030).
 *
 *   bun apps/web/scripts/set-handles.ts            # all demo users
 *   bun apps/web/scripts/set-handles.ts tomas sofia  # only these handles
 *
 * NOT shipped to prod — a dev convenience only.
 */
import { AuthenticationDetails, CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js';

const POOL_ID = 'eu-west-1_UtykCiLhC';
const CLIENT_ID = 'uck6d99i1quu8r6qmns6s9ppf';
const API = 'https://cch3zqvos9.execute-api.eu-west-1.amazonaws.com/v1';
const PASSWORD = 'Vozcoletiva!2026';

// email → handle. Mirrors seed-dev.ts.
const USERS = [
  { email: 'marina@example.com', handle: 'marina' },
  { email: 'tomas@example.com', handle: 'tomas' },
  { email: 'lucia@example.com', handle: 'lucia' },
  { email: 'rafael@example.com', handle: 'rafael' },
  { email: 'sofia@example.com', handle: 'sofia' },
] as const;

const pool = new CognitoUserPool({ UserPoolId: POOL_ID, ClientId: CLIENT_ID });

function login(email: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool });
    const auth = new AuthenticationDetails({ Username: email, Password: PASSWORD });
    user.authenticateUser(auth, {
      onSuccess: (s) => resolve(s.getAccessToken().getJwtToken()),
      onFailure: reject,
    });
  });
}

async function setHandle(token: string, handle: string): Promise<void> {
  const res = await fetch(`${API}/me/handle`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ handle }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PUT /me/handle (${handle}) → ${res.status} ${text}`);
}

async function main() {
  const only = process.argv.slice(2);
  const targets = only.length ? USERS.filter((u) => only.includes(u.handle)) : USERS;
  for (const u of targets) {
    try {
      const token = await login(u.email);
      await setHandle(token, u.handle);
      console.log(`✓ ${u.email} → @${u.handle}`);
    } catch (e) {
      console.error(`✗ ${u.email}: ${(e as Error).message}`);
    }
  }
}

await main();
