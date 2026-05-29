import type { ReactNode } from 'react';

interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** iOS-style segmented control. Equal-width segments; the active one gets a
 *  raised surface pill. */
export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <div
      className="mx-4 grid gap-1 rounded-full p-1"
      style={{
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        background: 'var(--surface-2)',
        border: '0.5px solid var(--border)',
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className="rounded-full py-1.5 text-[13px] font-semibold transition-colors"
            style={{
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--ink)' : 'var(--ink-soft)',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
