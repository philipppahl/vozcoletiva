/**
 * `@u-marina` style mentions live inline in the message body as tokens.
 * `parseMentions` splits the body into text + mention segments so the
 * renderer can style the mentions.
 */

export type Segment = { kind: 'text'; text: string } | { kind: 'mention'; userId: string };

const MENTION_RE = /(@[a-z][a-z0-9-]*)/gi;

export function parseMentions(body: string): Segment[] {
  if (!body) return [];
  const out: Segment[] = [];
  let lastIdx = 0;
  for (const m of body.matchAll(MENTION_RE)) {
    const start = m.index ?? 0;
    if (start > lastIdx) {
      out.push({ kind: 'text', text: body.slice(lastIdx, start) });
    }
    out.push({ kind: 'mention', userId: m[0].slice(1) });
    lastIdx = start + m[0].length;
  }
  if (lastIdx < body.length) {
    out.push({ kind: 'text', text: body.slice(lastIdx) });
  }
  return out;
}
