import { Trans } from '@lingui/macro';

import { useComments, useCreateComment } from '../lib/comments';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';

export function Comments({ slug, proposalId }: { slug: string; proposalId: string }) {
  const comments = useComments(slug, proposalId);
  const create = useCreateComment(slug, proposalId);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">
        <Trans>Comments</Trans>{' '}
        {comments.data && (
          <span style={{ color: 'var(--text-muted)' }}>· {comments.data.comments.length}</span>
        )}
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

      {comments.data && comments.data.comments.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Trans>No comments yet. Start the discussion.</Trans>
        </p>
      )}

      {comments.data && comments.data.comments.length > 0 && (
        <ul className="flex flex-col gap-3">
          {comments.data.comments.map((c) => (
            <CommentItem key={c.id} slug={slug} proposalId={proposalId} comment={c} />
          ))}
        </ul>
      )}

      {/* Composer is always visible — post-decision discussion stays open even
          after the proposal closes. (User decision, 2026-05-19.) */}
      <CommentForm
        busy={create.isPending}
        onSubmit={async (body) => {
          await create.mutateAsync(body);
        }}
      />
    </section>
  );
}
