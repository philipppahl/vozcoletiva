import { Trans } from '@lingui/macro';
import type { components } from '@vozcoletiva/api-client';
import { useMemo, useState } from 'react';
import {
  type CommentReplyTarget,
  useComments,
  useCreateComment,
  useToggleCommentReaction,
} from '../lib/comments';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';

type Comment = components['schemas']['Comment'];

/** A one-line preview of a comment, for the reply quote header. */
function previewOf(c: Comment): string {
  const flat = (c.body ?? '').split(/\s+/).filter(Boolean).join(' ');
  return flat.length > 120 ? `${flat.slice(0, 119)}…` : flat;
}

/**
 * Group flat comments into YouTube-style threads: a root comment plus every
 * reply that chains back to it (flattened to one level — replies-to-replies sit
 * alongside, with a "↳ name" marker). Replies whose parent is missing fall back
 * to being roots so nothing is hidden. Sorted oldest-first.
 */
function groupThreads(all: Comment[]): Array<{ root: Comment; replies: Comment[] }> {
  const byId = new Map(all.map((c) => [c.id, c]));
  const rootOf = (c: Comment): Comment => {
    let cur = c;
    const seen = new Set<string>();
    while (cur.reply_to && !seen.has(cur.id)) {
      const parent = byId.get(cur.reply_to.id);
      if (!parent) break;
      seen.add(cur.id);
      cur = parent;
    }
    return cur;
  };
  const byTime = (a: Comment, b: Comment) => a.created_at.localeCompare(b.created_at);
  const repliesByRoot = new Map<string, Comment[]>();
  const roots: Comment[] = [];
  for (const c of all) {
    const root = rootOf(c);
    if (root.id === c.id) {
      roots.push(c);
    } else {
      const list = repliesByRoot.get(root.id) ?? [];
      list.push(c);
      repliesByRoot.set(root.id, list);
    }
  }
  roots.sort(byTime);
  return roots.map((root) => ({
    root,
    replies: (repliesByRoot.get(root.id) ?? []).sort(byTime),
  }));
}

export function Comments({ slug, proposalId }: { slug: string; proposalId: string }) {
  const comments = useComments(slug, proposalId);
  const create = useCreateComment(slug, proposalId);
  const toggleReaction = useToggleCommentReaction(slug, proposalId);
  const [replyTo, setReplyTo] = useState<CommentReplyTarget | null>(null);

  const list = comments.data?.comments ?? [];
  const threads = useMemo(() => groupThreads(list), [list]);

  const replyTarget = (c: Comment): CommentReplyTarget => ({
    id: c.id,
    author_display_name: c.author_display_name,
    preview: previewOf(c),
  });

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">
        <Trans>Comments</Trans>{' '}
        {comments.data && <span style={{ color: 'var(--text-muted)' }}>· {list.length}</span>}
      </h2>

      {comments.isLoading && (
        <p style={{ color: 'var(--text-muted)' }}>
          <Trans>Loading…</Trans>
        </p>
      )}
      {comments.error && (
        <p style={{ color: 'var(--color-danger)' }}>
          <Trans>Could not load comments.</Trans>
        </p>
      )}

      {comments.data && list.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Trans>No comments yet. Start the discussion.</Trans>
        </p>
      )}

      {threads.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {threads.map(({ root, replies }) => (
            <li
              key={root.id}
              className="rounded-2xl border"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div className="p-3">
                <CommentItem
                  slug={slug}
                  proposalId={proposalId}
                  comment={root}
                  onReply={() => setReplyTo(replyTarget(root))}
                  onToggleReaction={(emoji, active) =>
                    toggleReaction.mutate({ commentId: root.id, emoji, active })
                  }
                />
              </div>
              {replies.length > 0 && (
                <ul className="flex flex-col gap-2 pb-2 pl-3 pr-3">
                  {replies.map((rep) => (
                    <li
                      key={rep.id}
                      className="border-l-2 pl-2.5"
                      style={{ borderColor: 'var(--border-hi)' }}
                    >
                      <CommentItem
                        compact
                        slug={slug}
                        proposalId={proposalId}
                        comment={rep}
                        onReply={() => setReplyTo(replyTarget(rep))}
                        onToggleReaction={(emoji, active) =>
                          toggleReaction.mutate({ commentId: rep.id, emoji, active })
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Composer is always visible — post-decision discussion stays open even
          after the proposal closes. (User decision, 2026-05-19.) */}
      <CommentForm
        busy={create.isPending}
        replyingTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSubmit={async (body) => {
          await create.mutateAsync({ body, replyTo });
          setReplyTo(null);
        }}
      />
    </section>
  );
}
