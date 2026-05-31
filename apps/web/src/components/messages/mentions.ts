/**
 * `@<user-id>` mentions live inline in the message body as tokens, where the id
 * is a Cognito `sub` (a lowercase UUID). The composer inserts these via the
 * member picker. `parseMentions` splits the body into text + mention segments so
 * the renderer can resolve and style them. The id is matched as a UUID so an
 * ordinary `@word` (or an email's `a@b`) isn't mistaken for a mention.
 */

export type Segment = { kind: 'text'; text: string } | { kind: 'mention'; userId: string };

const MENTION_RE = /@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

export function parseMentions(body: string): Segment[] {
  if (!body) return [];
  const out: Segment[] = [];
  let lastIdx = 0;
  for (const m of body.matchAll(MENTION_RE)) {
    const start = m.index ?? 0;
    if (start > lastIdx) {
      out.push({ kind: 'text', text: body.slice(lastIdx, start) });
    }
    out.push({ kind: 'mention', userId: m[1] ?? '' });
    lastIdx = start + m[0].length;
  }
  if (lastIdx < body.length) {
    out.push({ kind: 'text', text: body.slice(lastIdx) });
  }
  return out;
}
