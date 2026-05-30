import { beforeEach, describe, expect, it } from 'vitest';

import { getDb } from '../src/mocks/db';
import { handlers } from '../src/mocks/handlers';
import { seed } from '../src/mocks/seed';

beforeEach(() => seed({ identityKey: 'marina' }));

// MSW's per-handler `info`/`run` are internal — type them loosely for the test.
type LooseHandler = {
  info?: { method?: string; path?: unknown };
  run: (input: { request: Request; params: Record<string, string> }) => Promise<{
    response?: Response;
  } | null>;
};

/** Invoke the POST /proposals handler directly via MSW's resolver. */
async function createProposal(body: unknown): Promise<Response> {
  const handler = (handlers as unknown as LooseHandler[]).find(
    (h) =>
      h.info?.method === 'POST' && String(h.info?.path).endsWith('/v1/projects/:slug/proposals'),
  );
  if (!handler) throw new Error('proposals POST handler not found');
  const request = new Request('http://localhost/v1/projects/vila-madalena/proposals', {
    method: 'POST',
    headers: { authorization: 'Bearer mock', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await handler.run({ request, params: { slug: 'vila-madalena' } });
  if (!result?.response) throw new Error('handler returned no response');
  return result.response;
}

describe('multi-option decisions', () => {
  it('options[] creates a question root + one option child per label', async () => {
    const res = await createProposal({
      title: 'How many solar panels?',
      body: 'Pick the array size.',
      voting_rule: 'simple_majority',
      ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      options: ['14 panels', '20 panels', 'Lease'],
    });
    expect(res.status).toBe(201);
    const root = (await res.json()) as { id: string; is_question: boolean; title: string };
    expect(root.is_question).toBe(true);
    expect(root.title).toBe('How many solar panels?');

    const children = Array.from(getDb().proposals.values()).filter((p) => p.parentId === root.id);
    expect(children.map((c) => c.title).sort()).toEqual(['14 panels', '20 panels', 'Lease'].sort());
    // Options are lightweight (no body) and not questions themselves.
    expect(children.every((c) => c.body === '' && !c.isQuestion)).toBe(true);
  });

  it('a single option does not create a multi-option vote (stays a plain decision)', async () => {
    const res = await createProposal({
      title: 'Just one thing',
      body: 'body',
      voting_rule: 'simple_majority',
      ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      options: ['only option'],
    });
    const root = (await res.json()) as { id: string; is_question: boolean };
    expect(root.is_question).toBe(false);
    const children = Array.from(getDb().proposals.values()).filter((p) => p.parentId === root.id);
    expect(children).toHaveLength(0);
  });

  it('blank / whitespace option labels are ignored', async () => {
    const res = await createProposal({
      title: 'Q',
      body: 'b',
      voting_rule: 'simple_majority',
      ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      options: ['A', '  ', '', 'B'],
    });
    const root = (await res.json()) as { id: string; is_question: boolean };
    const children = Array.from(getDb().proposals.values()).filter((p) => p.parentId === root.id);
    expect(root.is_question).toBe(true);
    expect(children.map((c) => c.title).sort()).toEqual(['A', 'B']);
  });

  it('no options → plain decision (no question root)', async () => {
    const res = await createProposal({
      title: 'Plain decision',
      body: 'body',
      voting_rule: 'simple_majority',
      ends_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const root = (await res.json()) as { is_question: boolean };
    expect(root.is_question).toBe(false);
  });
});
