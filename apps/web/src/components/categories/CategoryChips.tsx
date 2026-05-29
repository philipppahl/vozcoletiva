import { Trans } from '@lingui/macro';

import type { Category } from '../../lib/categories/types';

interface CategoryChipsProps {
  categories: Category[];
  /** Selected category id, or null for "All". */
  selected: string | null;
  onChange: (next: string | null) => void;
}

export function CategoryChips({ categories, selected, onChange }: CategoryChipsProps) {
  if (categories.length === 0) return null;
  return (
    <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 pt-1" style={{ scrollbarWidth: 'none' }}>
      <Chip active={selected === null} onClick={() => onChange(null)}>
        <Trans>All</Trans>
      </Chip>
      {categories.map((c) => (
        <Chip key={c.id} active={selected === c.id} onClick={() => onChange(c.id)}>
          {c.name}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium"
      style={{
        background: active ? 'var(--ink)' : 'var(--surface)',
        color: active ? 'var(--bg)' : 'var(--ink)',
        border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
