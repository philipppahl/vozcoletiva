import { useMemberLookup } from '../lib/projects';
import { Avatar } from './shell/Avatar';

interface AuthorTagProps {
  slug: string;
  authorId: string | undefined;
  /** Used when the member can't be resolved (e.g. they left the project). */
  fallbackName?: string;
  /** Avatar diameter; the label scales with it. */
  size?: number;
  className?: string;
}

/**
 * Compact "author" chip — avatar + display name — resolved from the project
 * members list (proposal/document/comment DTOs carry only an author id). The
 * avatar shows the member's photo when set, initials otherwise.
 */
export function AuthorTag({ slug, authorId, fallbackName, size = 20, className }: AuthorTagProps) {
  const lookup = useMemberLookup(slug);
  const member = authorId ? lookup(authorId) : undefined;
  const name = member?.display_name ?? fallbackName;
  if (!name) return null;
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className ?? ''}`}>
      <Avatar displayName={name} imageUrl={member?.avatar_url} size={size} />
      <span
        className="truncate font-medium"
        style={{ color: 'var(--ink-soft)', fontSize: Math.max(11, size * 0.6) }}
      >
        {name}
      </span>
    </span>
  );
}
