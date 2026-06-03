import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';

import {
  type Availability,
  type HandleShapeError,
  handleShapeError,
  normalizeHandle,
} from '../lib/handle';
import { Field } from './ui/Field';

interface HandleFieldProps {
  value: string;
  onChange: (next: string) => void;
  availability: Availability;
  /** A claim failure surfaced from the mutation (e.g. lost a race). */
  claimError?: ReactNode;
  autoFocus?: boolean;
  /** Label override; defaults to "Handle". */
  label?: string;
}

/**
 * Handle input with live shape validation + availability feedback. Negative
 * states (bad shape, taken, claim failure) render as the field's error (red
 * border); positive/neutral states (available, checking) render as a status
 * line below. Reused by sign-up, the null-handle gate, and Preferences.
 */
export function HandleField({
  value,
  onChange,
  availability,
  claimError,
  autoFocus,
  label,
}: HandleFieldProps) {
  const { _ } = useLingui();
  const norm = normalizeHandle(value);
  const shapeErr = value.length > 0 ? handleShapeError(value) : null;

  // Field error: shape problem, or a "taken"/claim failure. One red message.
  let fieldError: ReactNode | undefined;
  if (claimError) fieldError = claimError;
  else if (shapeErr) fieldError = shapeMessage(shapeErr, _);
  else if (availability.state === 'taken') fieldError = _(t`@${norm} is already taken.`);

  return (
    <div className="flex flex-col gap-1">
      <Field
        label={label ?? _(t`Handle`)}
        value={value}
        // Lowercase + strip spaces as they type — mirrors server canonicalisation.
        onChange={(e) => onChange(e.currentTarget.value.replace(/\s+/g, '').toLowerCase())}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={20}
        autoFocus={autoFocus}
        error={fieldError ? String(fieldError) : undefined}
      />
      <StatusLine availability={availability} shapeErr={shapeErr} norm={norm} />
    </div>
  );
}

function StatusLine({
  availability,
  shapeErr,
  norm,
}: {
  availability: Availability;
  shapeErr: HandleShapeError | null;
  norm: string;
}) {
  // The field already shows shape errors + "taken"; the status line is just the
  // positive/neutral feedback, so it doesn't double up under the input.
  if (shapeErr || availability.state === 'taken') return null;
  if (availability.state === 'checking') {
    return (
      <span className="px-0.5 text-xs" style={{ color: 'var(--ink-muted)' }}>
        <Trans>Checking…</Trans>
      </span>
    );
  }
  if (availability.state === 'available') {
    return (
      <span className="px-0.5 text-xs font-medium" style={{ color: 'var(--yes)' }}>
        <Trans>@{norm} is available</Trans>
      </span>
    );
  }
  return (
    <span className="px-0.5 text-xs" style={{ color: 'var(--ink-muted)' }}>
      <Trans>Letters, numbers and _ — others will mention you as @{norm || 'name'}.</Trans>
    </span>
  );
}

function shapeMessage(err: HandleShapeError, _: (s: string) => string): string {
  switch (err) {
    case 'too_short':
      return _(t`At least 3 characters.`);
    case 'too_long':
      return _(t`At most 20 characters.`);
    case 'start_letter':
      return _(t`Must start with a letter.`);
    case 'charset':
      return _(t`Only letters, numbers and _.`);
  }
}
