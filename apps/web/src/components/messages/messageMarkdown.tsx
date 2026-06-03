import { useMembers } from '../../lib/projects';
import { parseMentions, type Segment } from './mentions';

interface MessageMarkdownProps {
  body: string;
  /** Used to resolve `@handle` mentions to the member's display name (tooltip). */
  projectSlug?: string;
  /** True inside the viewer's own (accent) bubble → light text + chips. */
  own?: boolean;
}

/**
 * Inline-only renderer for chat messages. Disables block-level Markdown
 * (headings, lists, blockquotes) — chat bubbles shouldn't carry that weight.
 * Supports **bold**, *italic*, `code`, [links](…), and @handle mentions.
 */
export function MessageMarkdown({ body, projectSlug, own = false }: MessageMarkdownProps) {
  const members = useMembers(projectSlug);
  const directory = members.data?.members ?? [];
  return (
    <span
      style={{
        color: own ? 'var(--accent-ink)' : 'var(--ink)',
        fontFamily: 'var(--font-sans)',
        fontSize: 14.5,
        lineHeight: 1.5,
        wordBreak: 'break-word',
      }}
    >
      {parseMentions(body).map((seg, idx) => (
        <SegmentView
          // biome-ignore lint/suspicious/noArrayIndexKey: parsed body is deterministic per render
          key={`${seg.kind}-${idx}-${seg.kind === 'mention' ? seg.handle : seg.text.slice(0, 8)}`}
          seg={seg}
          directory={directory}
          own={own}
        />
      ))}
    </span>
  );
}

interface DirectoryEntry {
  user_id: string;
  display_name: string;
  handle?: string | null;
}

function SegmentView({
  seg,
  directory,
  own,
}: {
  seg: Segment;
  directory: DirectoryEntry[];
  own: boolean;
}) {
  if (seg.kind === 'mention') {
    // Render the literal @handle; the member's name is a hover tooltip.
    const u = directory.find((d) => d.handle === seg.handle);
    return (
      <span
        className="rounded px-1 font-medium"
        title={u?.display_name}
        style={
          own
            ? { background: 'rgba(255,255,255,0.22)', color: 'var(--accent-ink)' }
            : { background: 'var(--accent-soft)', color: 'var(--accent)' }
        }
      >
        @{seg.handle}
      </span>
    );
  }
  return <RenderInline text={seg.text} own={own} />;
}

/**
 * A *very* small inline-Markdown renderer. Real linkification handled at the
 * boundary; we deliberately don't import remark/rehype here to keep bubbles
 * cheap. **bold**, *italic*, `code`, [text](url) only.
 */
function RenderInline({ text, own }: { text: string; own: boolean }) {
  // We split on the canonical markers, render each token as its element.
  // Greedy enough for chat; not a full parser. Order matters: code first
  // (the contents shouldn't be re-tokenised), then links, then bold, italic.
  const tokens = tokeniseInline(text);
  return (
    <>
      {tokens.map((t, i) => {
        const key = `${t.kind}-${i}-${t.text.slice(0, 8)}`;
        switch (t.kind) {
          case 'code':
            return (
              <code
                key={key}
                className="rounded px-1"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.92em',
                  background: own ? 'rgba(255,255,255,0.18)' : 'var(--surface-2)',
                  color: own ? 'var(--accent-ink)' : 'var(--ink-soft)',
                }}
              >
                {t.text}
              </code>
            );
          case 'link':
            return (
              <a
                key={key}
                href={t.url}
                target="_blank"
                rel="noreferrer noopener"
                style={{
                  color: own ? 'var(--accent-ink)' : 'var(--accent)',
                  textDecoration: 'underline',
                }}
              >
                {t.text}
              </a>
            );
          case 'bold':
            return (
              <strong key={key} style={{ fontWeight: 600 }}>
                {t.text}
              </strong>
            );
          case 'italic':
            return (
              <em key={key} style={{ fontStyle: 'italic' }}>
                {t.text}
              </em>
            );
          default:
            return <span key={key}>{t.text}</span>;
        }
      })}
    </>
  );
}

type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; url: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string };

function tokeniseInline(text: string): InlineToken[] {
  const out: InlineToken[] = [];
  let rest = text;
  // Patterns ordered: code, link, bold, italic. First match wins per cycle.
  const patterns: Array<{
    re: RegExp;
    make: (m: RegExpExecArray) => InlineToken;
  }> = [
    { re: /`([^`]+)`/, make: (m) => ({ kind: 'code', text: m[1]! }) },
    {
      re: /\[([^\]]+)\]\(([^)\s]+)\)/,
      make: (m) => ({ kind: 'link', text: m[1]!, url: m[2]! }),
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
