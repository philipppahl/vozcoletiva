import { t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { forwardRef, type InputHTMLAttributes, type ReactNode, useState } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  large?: boolean;
}

/**
 * Labelled text input with the design's 14 px radius + accent focus ring.
 * Password fields get a reveal (show/hide) toggle.
 */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, id, large, style, type, ...inputProps },
  ref,
) {
  const { _ } = useLingui();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword && revealed ? 'text' : type;
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
      <div style={{ position: 'relative' }}>
        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
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
            padding: isPassword ? '0 46px 0 16px' : '0 16px',
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
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? _(t`Hide password`) : _(t`Show password`)}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-0 flex items-center px-3"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ink-soft)',
            }}
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
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

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
