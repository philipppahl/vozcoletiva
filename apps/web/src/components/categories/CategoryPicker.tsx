import { Trans } from '@lingui/macro';

import type { Category } from '../../lib/categories/types';

interface CategoryPickerProps {
  categories: Category[];
  selected: string | undefined;
  onChange: (id: string) => void;
}

export function CategoryPicker({ categories, selected, onChange }: CategoryPickerProps) {
  if (categories.length === 0) return null;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend
        className="text-xs font-semibold uppercase"
        style={{ color: 'var(--ink-soft)', letterSpacing: 0.04 }}
      >
        <Trans>Topic</Trans>
      </legend>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => {
          const active = c.id === selected;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              aria-pressed={active}
              className="rounded-full px-3 py-1.5 text-sm font-medium"
              style={{
                background: active ? 'var(--ink)' : 'var(--surface)',
                color: active ? 'var(--bg)' : 'var(--ink)',
                border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                cursor: 'pointer',
              }}
            >
              {c.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
