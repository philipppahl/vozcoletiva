import { useCategories } from '../../lib/categories';

interface CategoryBadgeProps {
  slug: string;
  categoryId: string | null | undefined;
}

/** Small inline pill showing a proposal/document's category. Renders nothing
 *  when the id is missing or the lookup hasn't loaded yet. */
export function CategoryBadge({ slug, categoryId }: CategoryBadgeProps) {
  const { data } = useCategories(slug);
  if (!categoryId || !data) return null;
  const cat = data.categories.find((c) => c.id === categoryId);
  if (!cat) return null;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        background: 'var(--surface-2)',
        color: 'var(--ink-soft)',
        border: '0.5px solid var(--border)',
      }}
    >
      {cat.name}
    </span>
  );
}
