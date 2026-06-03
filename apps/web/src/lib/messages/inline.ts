/**
 * A *very* small inline tokenizer for chat bubbles (decision 0031). Pure (no
 * React / API) so it's unit-testable. Supports `code`, `[text](url)` links,
 * **bold**, *italic*, and **bare URLs** (auto-linkified — clickable, no preview
 * card). First match wins per cycle (earliest index), so a URL inside a
 * markdown link is consumed by the link pattern, not double-linkified.
 */

export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; url: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string };

export function tokeniseInline(text: string): InlineToken[] {
  const out: InlineToken[] = [];
  let rest = text;
  // Order: code, markdown link, bare url, bold, italic.
  const patterns: Array<{ re: RegExp; make: (m: RegExpExecArray) => InlineToken }> = [
    { re: /`([^`]+)`/, make: (m) => ({ kind: 'code', text: m[1]! }) },
    {
      re: /\[([^\]]+)\]\(([^)\s]+)\)/,
      make: (m) => ({ kind: 'link', text: m[1]!, url: m[2]! }),
    },
    {
      // Bare URL: stop before trailing punctuation so "(see https://x.com)." keeps
      // its ")" and ".".
      re: /(https?:\/\/[^\s<]*[^\s<.,;:!?)\]}'"])/,
      make: (m) => ({ kind: 'link', text: m[1]!, url: m[1]! }),
    },
    { re: /\*\*([^*]+)\*\*/, make: (m) => ({ kind: 'bold', text: m[1]! }) },
    {
      re: /(?<!\*)\*([^*\n]+)\*(?!\*)/,
      make: (m) => ({ kind: 'italic', text: m[1]! }),
    },
  ];
  // Brute-force loop — cheap for short bubble bodies.
  let guard = 0;
  while (rest && guard < 1000) {
    guard += 1;
    let earliest: { idx: number; len: number; tok: InlineToken } | null = null;
    for (const { re, make } of patterns) {
      const m = re.exec(rest);
      if (m && m.index !== undefined) {
        if (!earliest || m.index < earliest.idx) {
          earliest = { idx: m.index, len: m[0].length, tok: make(m) };
        }
      }
    }
    if (!earliest) {
      out.push({ kind: 'text', text: rest });
      break;
    }
    if (earliest.idx > 0) {
      out.push({ kind: 'text', text: rest.slice(0, earliest.idx) });
    }
    out.push(earliest.tok);
    rest = rest.slice(earliest.idx + earliest.len);
  }
  return out;
}
