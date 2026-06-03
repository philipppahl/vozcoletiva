/**
 * `@handle` mentions live inline in the message body as tokens (decision 0030).
 * The composer inserts these via the member picker. `parseMentions` splits the
 * body into text + mention segments so the renderer can resolve + style them.
 *
 * A mention is an `@` at a boundary (start, or after a non handle-character —
 * so an email's local part `marina@example.com` isn't mistaken for one),
 * followed by a 3–20 char `[A-Za-z0-9_]` handle that ends at a non
 * handle-character. The handle is lowercased to match the server's canonical
 * form. Kept in lockstep with the backend's `notify::extract_mentions`.
 */

export type Segment = { kind: 'text'; text: string } | { kind: 'mention'; handle: string };

const MENTION_RE = /(?<![A-Za-z0-9_])@([A-Za-z0-9_]{3,20})(?![A-Za-z0-9_])/g;

export function parseMentions(body: string): Segment[] {
  if (!body) return [];
  const out: Segment[] = [];
  let lastIdx = 0;
  for (const m of body.matchAll(MENTION_RE)) {
    const start = m.index ?? 0;
    if (start > lastIdx) {
      out.push({ kind: 'text', text: body.slice(lastIdx, start) });
    }
    out.push({ kind: 'mention', handle: (m[1] ?? '').toLowerCase() });
    lastIdx = start + m[0].length;
  }
  if (lastIdx < body.length) {
    out.push({ kind: 'text', text: body.slice(lastIdx) });
  }
  return out;
}
