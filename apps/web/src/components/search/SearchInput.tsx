import { t } from '@lingui/macro';
import { useLingui } from '@lingui/react';

interface SearchInputProps {
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
}

export function SearchInput({ value, onChange, autoFocus }: SearchInputProps) {
  const { _ } = useLingui();
  return (
    <div
      className="relative mx-4 mt-4 flex items-center"
      style={{
        background: 'var(--field-bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute"
        style={{ left: 12, top: 11, color: 'var(--ink-muted)' }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={_(t`Search this project…`)}
        // biome-ignore lint/a11y/noAutofocus: search is the primary action on this route
        autoFocus={autoFocus}
        className="min-h-[40px] w-full bg-transparent pl-9 pr-9 text-[15px] outline-none"
        style={{ color: 'var(--ink)' }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={_(t`Clear search`)}
          className="absolute"
          style={{
            right: 6,
            top: 6,
            width: 28,
            height: 28,
            borderRadius: 999,
            background: 'transparent',
            border: 'none',
            color: 'var(--ink-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
