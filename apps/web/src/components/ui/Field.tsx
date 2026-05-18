import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
}

/**
 * Minimal styled form field. Pairs a label with an input and an inline error
 * slot. Future component-primitives slice will swap the underlying primitive
 * to Radix; for now an accessible <label> + <input> is enough.
 */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, id, ...inputProps },
  ref,
) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const errorId = `${inputId}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="text-sm font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="min-h-[44px] rounded-xl border px-3.5 py-2 text-base outline-none transition focus:ring-2"
        style={{
          background: 'var(--surface)',
          borderColor: error ? 'var(--color-danger)' : 'var(--border)',
          color: 'var(--text-primary)',
        }}
        {...inputProps}
      />
      {hint && !error && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="text-xs" style={{ color: 'var(--color-danger)' }}>
          {error}
        </span>
      )}
    </div>
  );
});
