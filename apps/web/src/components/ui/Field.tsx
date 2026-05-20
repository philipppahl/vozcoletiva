import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  large?: boolean;
}

/**
 * Labelled text input with the design's 14 px radius + accent focus ring.
 */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, id, large, style, ...inputProps },
  ref,
) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const errorId = `${inputId}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--ink-soft)', letterSpacing: 0.04 }}
      >
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        style={{
          appearance: 'none',
          width: '100%',
          boxSizing: 'border-box',
          background: 'var(--field-bg)',
          color: 'var(--ink)',
          border: `1px solid ${error ? 'var(--no)' : 'transparent'}`,
          borderRadius: 'var(--radius-field)',
          padding: '0 16px',
          height: large ? 56 : 48,
          fontFamily: 'var(--font-sans)',
          fontSize: large ? 17 : 15,
          lineHeight: 1.5,
          outline: 'none',
          transition: 'border-color .12s ease, box-shadow .12s ease',
          ...style,
        }}
        onFocus={(e) => {
          if (error) return;
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.boxShadow =
            '0 0 0 3px color-mix(in oklab, var(--accent) 18%, transparent)';
        }}
        onBlur={(e) => {
          if (error) return;
          e.currentTarget.style.borderColor = 'transparent';
          e.currentTarget.style.boxShadow = 'none';
        }}
        {...inputProps}
      />
      {hint && !error && (
        <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="text-xs" style={{ color: 'var(--no)' }}>
          {error}
        </span>
      )}
    </div>
  );
});
