import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useState } from 'react';

import { useAuth } from '../lib/auth/hooks';
import { useDeleteComment, useEditComment } from '../lib/comments';
import { useMemberLookup } from '../lib/projects';
import { CommentForm } from './CommentForm';
import { Markdown } from './Markdown';
import { RelativeTime } from './RelativeTime';
import { Avatar } from './shell/Avatar';

interface Comment {
  id: string;
  author_id: string;
  author_display_name: string;
  body?: string | null;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
}

interface Props {
  slug: string;
  proposalId: string;
  comment: Comment;
}

export function CommentItem({ slug, proposalId, comment }: Props) {
  const { _ } = useLingui();
  const { session } = useAuth();
  const edit = useEditComment(slug, proposalId);
  const del = useDeleteComment(slug, proposalId);
  const lookup = useMemberLookup(slug);
  const [editing, setEditing] = useState(false);

  const isAuthor = session?.userId === comment.author_id;
  const isDeleted = comment.deleted_at != null;

  if (isDeleted) {
    return (
      <li
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
        style={{ color: 'var(--text-muted)', background: 'var(--surface)' }}
      >
        <Trans>Comment deleted</Trans>
        <span>·</span>
        <RelativeTime iso={comment.created_at} />
      </li>
    );
  }

  return (
    <li
      className="flex flex-col gap-2 rounded-2xl border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <header
        className="flex flex-wrap items-center gap-2 text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        <Avatar
          displayName={comment.author_display_name}
          imageUrl={lookup(comment.author_id)?.avatar_url}
          size={22}
        />
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {comment.author_display_name}
        </span>
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
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full px-2 py-1 text-xs font-semibold"
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
              className="rounded-full px-2 py-1 text-xs font-semibold"
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
        <Markdown source={comment.body ?? ''} />
      )}
    </li>
  );
}
