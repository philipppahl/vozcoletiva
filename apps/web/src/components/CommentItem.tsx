import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import type { components } from '@vozcoletiva/api-client';
import { useState } from 'react';
import { useAuth } from '../lib/auth/hooks';
import { useDeleteComment, useEditComment } from '../lib/comments';
import { REACTIONS } from '../lib/messages/types';
import { useMemberLookup } from '../lib/projects';
import { CommentForm } from './CommentForm';
import { Markdown } from './Markdown';
import { RelativeTime } from './RelativeTime';
import { Avatar } from './shell/Avatar';

type Comment = components['schemas']['Comment'];

interface Props {
  slug: string;
  proposalId: string;
  comment: Comment;
  /** Start a quote-reply to this comment (decision 0033). */
  onReply?: () => void;
  /** Toggle a reaction on this comment. */
  onToggleReaction?: (emoji: string, active: boolean) => void;
  /** A nested reply: smaller avatar, tighter spacing, "↳ name" in the meta row
   *  instead of a quote block (the parent is right above it). */
  compact?: boolean;
}

export function CommentItem({
  slug,
  proposalId,
  comment,
  onReply,
  onToggleReaction,
  compact = false,
}: Props) {
  const { _ } = useLingui();
  const { session } = useAuth();
  const edit = useEditComment(slug, proposalId);
  const del = useDeleteComment(slug, proposalId);
  const lookup = useMemberLookup(slug);
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const isAuthor = session?.userId === comment.author_id;
  const isDeleted = comment.deleted_at != null;

  if (isDeleted) {
    return (
      <div
        className="flex items-center gap-2 py-0.5 text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        <Trans>Comment deleted</Trans>
        <span>·</span>
        <RelativeTime iso={comment.created_at} />
      </div>
    );
  }

  // Defensive: a comment restored from a persisted pre-0033 cache has no
  // reactions array yet.
  const reactions = comment.reactions ?? [];

  const react = (emoji: string, active: boolean) => {
    onToggleReaction?.(emoji, active);
    setPickerOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <header
        className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        <Avatar
          displayName={comment.author_display_name}
          imageUrl={lookup(comment.author_id)?.avatar_url}
          size={compact ? 18 : 22}
        />
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {comment.author_display_name}
        </span>
        {/* Nested replies show who they answer in the meta row (compact). */}
        {compact && comment.reply_to && (
          <span style={{ color: 'var(--accent)' }}>↳ {comment.reply_to.author_display_name}</span>
        )}
        <span>·</span>
        <RelativeTime iso={comment.created_at} />
        {comment.edited_at && (
          <>
            <span>·</span>
            <span>
              <Trans>(edited)</Trans>
            </span>
          </>
        )}
        {isAuthor && !editing && (
          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full px-1.5 py-0.5 text-xs font-semibold"
              style={{ color: 'var(--brand)' }}
            >
              <Trans>Edit</Trans>
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && !window.confirm(_(t`Delete this comment?`))) {
                  return;
                }
                del.mutate(comment.id);
              }}
              className="rounded-full px-1.5 py-0.5 text-xs font-semibold"
              style={{ color: 'var(--color-danger)' }}
              disabled={del.isPending}
            >
              <Trans>Delete</Trans>
            </button>
          </span>
        )}
      </header>

      {editing ? (
        <CommentForm
          initialBody={comment.body ?? ''}
          submitLabel={_(t`Save`)}
          busy={edit.isPending}
          autoFocus
          onCancel={() => setEditing(false)}
          onSubmit={async (newBody) => {
            await edit.mutateAsync({ commentId: comment.id, body: newBody });
            setEditing(false);
          }}
        />
      ) : (
        <>
          {/* Non-compact only: a quote block for an orphaned reply (its parent
              isn't shown above). Nested replies use the meta-row "↳ name". */}
          {!compact && comment.reply_to && (
            <div
              className="rounded-lg border-l-2 px-2.5 py-1.5 text-xs"
              style={{ borderColor: 'var(--accent)', background: 'var(--surface-2)' }}
            >
              <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                {comment.reply_to.author_display_name}
              </span>
              <span className="ml-1.5 truncate" style={{ color: 'var(--ink-muted)' }}>
                {comment.reply_to.preview || _(t`(no text)`)}
              </span>
            </div>
          )}
          <div style={{ fontSize: compact ? 14 : 15 }}>
            <Markdown source={comment.body ?? ''} />
          </div>

          {/* Reaction pills + actions (chat-style; decision 0033) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => react(r.emoji, !r.me)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: r.me ? 'var(--accent-soft)' : 'var(--surface-2)',
                  border: `1px solid ${r.me ? 'var(--accent)' : 'var(--border)'}`,
                  color: 'var(--ink)',
                  cursor: 'pointer',
                }}
                aria-pressed={r.me}
              >
                <span>{r.emoji}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.count}</span>
              </button>
            ))}

            {onToggleReaction && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  aria-label={_(t`Add reaction`)}
                  className="inline-flex h-6 items-center rounded-full px-2 text-xs"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--ink-soft)',
                    cursor: 'pointer',
                  }}
                >
                  🙂<span style={{ marginLeft: 1, fontWeight: 600 }}>+</span>
                </button>
                {pickerOpen && (
                  <div
                    className="absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-full px-2 py-1"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-md)',
                    }}
                  >
                    {REACTIONS.map((emoji) => {
                      const mine = reactions.some((r) => r.emoji === emoji && r.me);
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => react(emoji, !mine)}
                          aria-label={emoji}
                          className="rounded-full px-1 text-lg leading-none"
                          style={{
                            background: mine ? 'var(--accent-soft)' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {onReply && (
              <button
                type="button"
                onClick={onReply}
                className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ background: 'transparent', border: 'none', color: 'var(--ink-soft)' }}
              >
                <Trans>Reply</Trans>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
