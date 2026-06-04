import { Plural, Trans } from '@lingui/macro';
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

interface TreeNode {
  comment: Comment;
  children: TreeNode[];
}

/** A one-line preview of a comment, for the reply quote header. */
function previewOf(c: Comment): string {
  const flat = (c.body ?? '').split(/\s+/).filter(Boolean).join(' ');
  return flat.length > 120 ? `${flat.slice(0, 119)}…` : flat;
}

/**
 * Build the reply tree: each comment nests under the one it replies to
 * (decision 0033, revised — replies are shown beneath their parent, not
 * flattened). A reply whose parent is missing becomes a root so nothing is
 * hidden. Children are ordered oldest-first.
 */
function buildTree(all: Comment[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>(all.map((c) => [c.id, { comment: c, children: [] }]));
  const roots: TreeNode[] = [];
  for (const c of all) {
    const node = nodes.get(c.id);
    if (!node) continue;
    const parent = c.reply_to ? nodes.get(c.reply_to.id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: TreeNode[]) => {
    list.sort((a, b) => a.comment.created_at.localeCompare(b.comment.created_at));
    for (const n of list) sort(n.children);
  };
  sort(roots);
  return roots;
}

function countDescendants(node: TreeNode): number {
  return node.children.reduce((n, c) => n + 1 + countDescendants(c), 0);
}

interface NodeProps {
  node: TreeNode;
  depth: number;
  slug: string;
  proposalId: string;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  onReply: (c: Comment) => void;
  onReact: (commentId: string, emoji: string, active: boolean) => void;
}

function CommentNode({
  node,
  depth,
  slug,
  proposalId,
  collapsed,
  onToggleCollapse,
  onReply,
  onReact,
}: NodeProps) {
  const { comment, children } = node;
  const hasChildren = children.length > 0;
  const isCollapsed = collapsed.has(comment.id);
  const total = hasChildren ? countDescendants(node) : 0;

  return (
    <div>
      <CommentItem
        compact={depth > 0}
        slug={slug}
        proposalId={proposalId}
        comment={comment}
        onReply={() => onReply(comment)}
        onToggleReaction={(emoji, active) => onReact(comment.id, emoji, active)}
      />
      {hasChildren && (
        <button
          type="button"
          onClick={() => onToggleCollapse(comment.id)}
          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold"
          style={{ color: 'var(--accent)', background: 'transparent', border: 'none' }}
          aria-expanded={!isCollapsed}
        >
          <span
            style={{
              display: 'inline-block',
              transform: isCollapsed ? 'none' : 'rotate(90deg)',
              transition: 'transform 0.15s',
            }}
          >
            ›
          </span>
          {isCollapsed ? (
            <Plural value={total} one="# reply" other="# replies" />
          ) : (
            <Trans>Hide replies</Trans>
          )}
        </button>
      )}
      {hasChildren && !isCollapsed && (
        <ul
          className="mt-1.5 flex flex-col gap-1.5 border-l-2 pl-2.5"
          style={{ borderColor: 'var(--border-hi)' }}
        >
          {children.map((child) => (
            <li key={child.comment.id}>
              <CommentNode
                node={child}
                depth={depth + 1}
                slug={slug}
                proposalId={proposalId}
                collapsed={collapsed}
                onToggleCollapse={onToggleCollapse}
                onReply={onReply}
                onReact={onReact}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface CommentsProps {
  slug: string;
  proposalId: string;
  /** Whether the on-demand composer is open (opened by the "+" FAB or a Reply,
   *  owned by the proposal page so the FAB can toggle it). */
  composing: boolean;
  onComposingChange: (open: boolean) => void;
}

export function Comments({ slug, proposalId, composing, onComposingChange }: CommentsProps) {
  const comments = useComments(slug, proposalId);
  const create = useCreateComment(slug, proposalId);
  const toggleReaction = useToggleCommentReaction(slug, proposalId);
  const [replyTo, setReplyTo] = useState<CommentReplyTarget | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const list = comments.data?.comments ?? [];
  const roots = useMemo(() => buildTree(list), [list]);

  const startReply = (c: Comment) => {
    setReplyTo({
      id: c.id,
      author_display_name: c.author_display_name,
      preview: previewOf(c),
    });
    onComposingChange(true);
  };

  const closeComposer = () => {
    onComposingChange(false);
    setReplyTo(null);
  };

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
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

      {roots.length > 0 && (
        <ul className="flex flex-col gap-2">
          {roots.map((root) => (
            <li
              key={root.comment.id}
              className="rounded-2xl border"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div className="px-3 py-2.5">
                <CommentNode
                  node={root}
                  depth={0}
                  slug={slug}
                  proposalId={proposalId}
                  collapsed={collapsed}
                  onToggleCollapse={toggleCollapse}
                  onReply={startReply}
                  onReact={(commentId, emoji, active) =>
                    toggleReaction.mutate({ commentId, emoji, active })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* The composer opens on demand from the "+" FAB or a Reply (the field
          then sits above the keyboard, with the footer hidden). */}
      {composing && (
        <CommentForm
          autoFocus
          busy={create.isPending}
          replyingTo={replyTo}
          onCancel={closeComposer}
          onCancelReply={() => setReplyTo(null)}
          onSubmit={async (body) => {
            await create.mutateAsync({ body, replyTo });
            closeComposer();
          }}
        />
      )}
    </section>
  );
}
