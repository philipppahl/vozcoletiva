#!/usr/bin/env bun
/**
 * Seed the voz-dev backend with realistic data through the **public API** (no
 * backdoor writes), using real Cognito users.
 *
 *   bun apps/web/scripts/seed-dev.ts
 *
 * Prereqs: the 5 demo users exist in the pool (AdminCreateUser + permanent
 * password) and the new Lambda is deployed. Idempotent: wipes all app items in
 * the dev table first, then recreates everything.
 *
 * NOT shipped to prod — a dev convenience only.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

import { AuthenticationDetails, CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js';

const REGION = 'eu-west-1';
const POOL_ID = 'eu-west-1_UtykCiLhC';
const CLIENT_ID = 'uck6d99i1quu8r6qmns6s9ppf';
const TABLE = 'vozcoletiva-dev';
const WORKER_FN = 'voz-dev-worker';
const API = 'https://cch3zqvos9.execute-api.eu-west-1.amazonaws.com/v1';
const PASSWORD = 'Vozcoletiva!2026';

const USERS = [
  { email: 'marina@example.com', name: 'Marina Alves' },
  { email: 'tomas@example.com', name: 'Tomás Ferreira' },
  { email: 'lucia@example.com', name: 'Lúcia Pereira' },
  { email: 'rafael@example.com', name: 'Rafael Costa' },
  { email: 'sofia@example.com', name: 'Sofia Martins' },
] as const;

type Session = { email: string; token: string; sub: string };

const pool = new CognitoUserPool({ UserPoolId: POOL_ID, ClientId: CLIENT_ID });

function login(email: string): Promise<Session> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool });
    const auth = new AuthenticationDetails({ Username: email, Password: PASSWORD });
    user.authenticateUser(auth, {
      onSuccess: (s) => {
        const access = s.getAccessToken();
        resolve({ email, token: access.getJwtToken(), sub: access.decodePayload().sub as string });
      },
      onFailure: reject,
    });
  });
}

async function api<T = unknown>(
  s: Session,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${s.token}`,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

function aws(args: string[]): string {
  const r = spawnSync('aws', [...args, '--region', REGION], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`aws ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

/** Close a deliberation by invoking the worker Lambda directly (AWS CLI v1). */
function close(projectId: string, proposalId: string): void {
  const payloadFile = '/tmp/voz-worker-payload.json';
  const outFile = '/tmp/voz-worker-out.json';
  writeFileSync(payloadFile, JSON.stringify({ project_id: projectId, proposal_id: proposalId }));
  const r = spawnSync(
    'aws',
    [
      'lambda',
      'invoke',
      '--function-name',
      WORKER_FN,
      '--region',
      REGION,
      '--payload',
      `file://${payloadFile}`,
      outFile,
    ],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error(`worker invoke failed: ${r.stderr}`);
  const meta = JSON.parse(r.stdout) as { FunctionError?: string };
  if (meta.FunctionError) {
    throw new Error(`worker close errored: ${readFileSync(outFile, 'utf8')}`);
  }
}

/** Delete every app item in the dev table so the seed is repeatable. */
function wipeTable(): void {
  let startKey: string | undefined;
  let total = 0;
  do {
    const args = [
      'dynamodb',
      'scan',
      '--table-name',
      TABLE,
      '--projection-expression',
      'PK,SK',
      '--output',
      'json',
    ];
    if (startKey) args.push('--exclusive-start-key', startKey);
    const out = JSON.parse(aws(args)) as {
      Items: { PK: { S: string }; SK: { S: string } }[];
      LastEvaluatedKey?: unknown;
    };
    for (const it of out.Items) {
      aws([
        'dynamodb',
        'delete-item',
        '--table-name',
        TABLE,
        '--key',
        JSON.stringify({ PK: it.PK, SK: it.SK }),
      ]);
      total += 1;
    }
    startKey = out.LastEvaluatedKey ? JSON.stringify(out.LastEvaluatedKey) : undefined;
  } while (startKey);
  console.log(`  wiped ${total} items`);
}

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

type Proposal = { id: string; is_question: boolean };

async function main() {
  console.log('• wiping dev table…');
  wipeTable();

  console.log('• signing in demo users (SRP)…');
  const sessions: Record<string, Session> = {};
  for (const u of USERS) {
    sessions[u.email] = await login(u.email);
    console.log(`  ${u.email} → ${sessions[u.email].sub}`);
  }
  const S = (email: string) => sessions[email];

  // Bootstrap each profile's display name via the API (Cognito is auth-only —
  // decision 0019). Must run before projects/invites so memberships + messages
  // denormalise the real name rather than the user id.
  console.log('• setting display names…');
  for (const u of USERS) {
    await api(S(u.email), 'PATCH', '/me', { display_name: u.name });
  }

  // ── helpers bound to a member's session ──────────────────────────────────
  const topicId = async (s: Session, slug: string, name: string): Promise<string> => {
    const { categories } = await api<{ categories: { id: string; name: string }[] }>(
      s,
      'GET',
      `/projects/${slug}/categories`,
    );
    const found = categories.find((c) => c.name === name);
    if (found) return found.id;
    const c = await api<{ id: string }>(s, 'POST', `/projects/${slug}/categories`, { name });
    return c.id;
  };
  const propose = (s: Session, slug: string, body: Record<string, unknown>) =>
    api<Proposal>(s, 'POST', `/projects/${slug}/proposals`, body);
  const tree = (s: Session, slug: string, id: string) =>
    api<{
      proposals: { id: string; title: string; is_question: boolean; parent_id: string | null }[];
    }>(s, 'GET', `/projects/${slug}/proposals/${id}/tree`);
  const vote = (s: Session, slug: string, id: string, choice: string) =>
    api(s, 'POST', `/projects/${slug}/proposals/${id}/vote`, { choice });
  const comment = (s: Session, slug: string, id: string, bodyMd: string) =>
    api(s, 'POST', `/projects/${slug}/proposals/${id}/comments`, { body: bodyMd });
  const invite = async (owner: Session, slug: string, invitee: Session, role = 'member') => {
    const inv = await api<{ token: string }>(owner, 'POST', `/projects/${slug}/invites`, { role });
    await api(invitee, 'POST', `/invites/${inv.token}/accept`);
  };
  // ── messaging (slice E) ──────────────────────────────────────────────────
  const commonsChannel = async (s: Session, slug: string): Promise<string> => {
    const { channels } = await api<{ channels: { id: string; name: string }[] }>(
      s,
      'GET',
      `/projects/${slug}/channels`,
    );
    const found = channels.find((c) => c.name === 'Commons') ?? channels[0];
    if (!found) throw new Error(`no channels for ${slug}`);
    return found.id;
  };
  const postMsg = (s: Session, convId: string, body: string, parent?: string) =>
    api<{ id: string }>(s, 'POST', `/conversations/${convId}/messages`, {
      body,
      parent_message_id: parent ?? null,
    });
  const markRead = (s: Session, convId: string, messageId: string) =>
    api(s, 'POST', `/conversations/${convId}/read`, { message_id: messageId });

  // ── Project 1: Vila Madalena (owner: marina) ─────────────────────────────
  console.log('• project: Vila Madalena');
  const marina = S('marina@example.com');
  const p1 = await api<{ id: string; slug: string }>(marina, 'POST', '/projects', {
    name: 'Vila Madalena',
    slug: 'vila-madalena',
    template: 'community',
  });
  for (const u of ['tomas@example.com', 'lucia@example.com', 'rafael@example.com']) {
    await invite(marina, p1.slug, S(u));
  }
  const mob = await topicId(marina, p1.slug, 'Mobilidade');
  const esp = await topicId(marina, p1.slug, 'Espaços Públicos');

  // 1) plain decision → passes
  const bici = await propose(marina, p1.slug, {
    title: 'Instalar bicicletário na Praça Benedito Calixto',
    body: 'Proposta para instalar 20 vagas de bicicletário coberto na praça.',
    voting_rule: 'simple_majority',
    category_id: mob,
    ends_at: inDays(3),
  });
  await vote(marina, p1.slug, bici.id, bici.id);
  await vote(S('tomas@example.com'), p1.slug, bici.id, bici.id);
  await vote(S('lucia@example.com'), p1.slug, bici.id, bici.id);
  await vote(S('rafael@example.com'), p1.slug, bici.id, '__none__');
  await comment(
    S('tomas@example.com'),
    p1.slug,
    bici.id,
    'Ótima ideia! Perto do metrô seria ideal.',
  );
  await comment(S('lucia@example.com'), p1.slug, bici.id, 'Concordo, mas precisa de cobertura.');
  close(p1.id, bici.id);

  // 2) multi-option → plurality
  const feira = await propose(marina, p1.slug, {
    title: 'Qual o melhor horário para a feira de rua?',
    body: 'Escolha um horário para a feira semanal.',
    voting_rule: 'plurality',
    category_id: mob,
    ends_at: inDays(2),
    options: ['Sábado de manhã', 'Domingo de manhã', 'Sexta à tarde'],
  });
  const feiraTree = await tree(marina, p1.slug, feira.id);
  const opt = (label: string) => feiraTree.proposals.find((x) => x.title === label)!.id;
  await vote(marina, p1.slug, feira.id, opt('Sábado de manhã'));
  await vote(S('tomas@example.com'), p1.slug, feira.id, opt('Sábado de manhã'));
  await vote(S('lucia@example.com'), p1.slug, feira.id, opt('Sábado de manhã'));
  await vote(S('rafael@example.com'), p1.slug, feira.id, opt('Domingo de manhã'));
  close(p1.id, feira.id);

  // 3) decision + fork → left OPEN for live testing
  const parque = await propose(marina, p1.slug, {
    title: 'Reformar o parquinho infantil',
    body: 'Troca dos brinquedos e piso emborrachado.',
    voting_rule: 'simple_majority',
    category_id: esp,
    ends_at: inDays(5),
  });
  await propose(S('lucia@example.com'), p1.slug, {
    title: 'Alternativa: criar uma horta comunitária no terreno',
    body: 'Em vez do parquinho, uma horta gerida pelos moradores.',
    parent_id: parque.id,
  });
  await vote(marina, p1.slug, parque.id, parque.id);
  await comment(
    marina,
    p1.slug,
    parque.id,
    'As duas ideias são boas — vamos debater na próxima reunião.',
  );

  // 4) document + amendment → two versions
  const doc1 = await propose(marina, p1.slug, {
    title: 'Regras de Convivência — v1',
    body: '## Regras de Convivência\n\n1. Silêncio após as 22h.\n2. Lixo reciclável às terças.',
    voting_rule: 'two_thirds',
    proposal_kind: 'document',
    document_name: 'Regras de Convivência',
    ends_at: inDays(2),
  });
  for (const u of USERS.slice(0, 3)) await vote(S(u.email), p1.slug, doc1.id, doc1.id);
  close(p1.id, doc1.id);
  const doc2 = await propose(S('tomas@example.com'), p1.slug, {
    title: 'Regras de Convivência — revisão',
    body: '## Regras de Convivência\n\n1. Silêncio após as 22h.\n2. Lixo reciclável às terças e sextas.\n3. Animais sempre na guia.',
    voting_rule: 'two_thirds',
    proposal_kind: 'document',
    document_name: 'Regras de Convivência',
    ends_at: inDays(2),
  });
  for (const u of USERS.slice(0, 3)) await vote(S(u.email), p1.slug, doc2.id, doc2.id);
  close(p1.id, doc2.id);

  // 5) consensus decision → left OPEN
  const nome = await propose(marina, p1.slug, {
    title: 'Adotar o nome “Comunidade Vila Madalena”',
    body: 'Nome oficial da associação de moradores.',
    voting_rule: 'consensus',
    ends_at: inDays(6),
  });
  await vote(marina, p1.slug, nome.id, nome.id);
  await vote(S('lucia@example.com'), p1.slug, nome.id, nome.id);

  // ── Project 2: Cooperativa Solar (owner: tomas) ──────────────────────────
  console.log('• project: Cooperativa Solar');
  const tomas = S('tomas@example.com');
  const p2 = await api<{ id: string; slug: string }>(tomas, 'POST', '/projects', {
    name: 'Cooperativa Solar',
    slug: 'cooperativa-solar',
    template: 'cooperative',
  });
  for (const u of ['sofia@example.com', 'marina@example.com']) await invite(tomas, p2.slug, S(u));
  const energia = await topicId(tomas, p2.slug, 'Energia');
  const paineis = await propose(tomas, p2.slug, {
    title: 'Comprar 20 painéis solares para o telhado coletivo',
    body: 'Investimento inicial de R$ 60.000, retorno em ~4 anos.',
    voting_rule: 'simple_majority',
    category_id: energia,
    ends_at: inDays(7),
  });
  await vote(tomas, p2.slug, paineis.id, paineis.id);
  await vote(S('sofia@example.com'), p2.slug, paineis.id, paineis.id);
  const estatuto = await propose(tomas, p2.slug, {
    title: 'Estatuto da Cooperativa — v1',
    body: '## Estatuto\n\nArt. 1º A cooperativa tem por objeto a geração de energia solar.',
    voting_rule: 'two_thirds',
    proposal_kind: 'document',
    document_name: 'Estatuto da Cooperativa',
    ends_at: inDays(2),
  });
  await vote(tomas, p2.slug, estatuto.id, estatuto.id);
  await vote(S('sofia@example.com'), p2.slug, estatuto.id, estatuto.id);
  await vote(marina, p2.slug, estatuto.id, estatuto.id);
  close(p2.id, estatuto.id);

  // ── channel chat (slice E): seed each project's default Commons channel ───
  console.log('• channel chat: Vila Madalena #Commons');
  const c1 = await commonsChannel(marina, p1.slug);
  await postMsg(marina, c1, 'Bem-vindos ao canal da Vila Madalena! 👋');
  const topic1 = await postMsg(
    S('tomas@example.com'),
    c1,
    'Alguém viu a proposta do bicicletário? Acho que vale a pena debater aqui.',
  );
  await postMsg(S('lucia@example.com'), c1, 'Concordo! Já votei a favor.', topic1.id);
  await postMsg(marina, c1, 'Vou levar para a próxima reunião também.', topic1.id);
  await postMsg(S('rafael@example.com'), c1, 'Boa noite a todos, acabei de entrar no grupo.');
  // marina has read up to her own last message; tomas/lucia leave some unread.
  await markRead(marina, c1, topic1.id);

  console.log('• channel chat: Cooperativa Solar #Commons');
  const c2 = await commonsChannel(tomas, p2.slug);
  await postMsg(tomas, c2, 'Orçamento dos painéis chegou — R$ 58.400 fechado. 🎉');
  const q2 = await postMsg(S('sofia@example.com'), c2, 'Qual a previsão de instalação?');
  await postMsg(tomas, c2, 'Em torno de 3 semanas após a aprovação.', q2.id);

  console.log('\n✓ seed complete.');
  console.log(`  Projects: ${p1.slug}, ${p2.slug}`);
  console.log('  Sign in at the app as marina@example.com / ' + PASSWORD);
}

main().catch((e) => {
  console.error('✗ seed failed:', e);
  process.exit(1);
});
