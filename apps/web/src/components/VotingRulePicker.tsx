import { Trans } from '@lingui/macro';
import type { ReactNode } from 'react';

import type { VotingRule } from '../lib/proposals/types';

interface VotingRulePickerProps {
  value: VotingRule;
  onChange: (next: VotingRule) => void;
}

interface RuleSpec {
  id: VotingRule;
  title: ReactNode;
  hint: ReactNode;
}

const RULES: RuleSpec[] = [
  {
    id: 'simple_majority',
    title: <Trans>Simple majority</Trans>,
    hint: <Trans>The winning option needs more than half of the decisive votes.</Trans>,
  },
  {
    id: 'two_thirds',
    title: <Trans>Two-thirds</Trans>,
    hint: <Trans>The winning option needs at least two-thirds of the decisive votes.</Trans>,
  },
  {
    id: 'plurality',
    title: <Trans>Plurality</Trans>,
    hint: <Trans>Most votes wins. Ties leave no winner.</Trans>,
  },
  {
    id: 'consensus',
    title: <Trans>Consensus</Trans>,
    hint: (
      <Trans>
        All decisive voters must pick the same option. Silence (abstain) counts as consent.
      </Trans>
    ),
  },
];

export function VotingRulePicker({ value, onChange }: VotingRulePickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="text-xs font-semibold uppercase"
        style={{ color: 'var(--ink-soft)', letterSpacing: 0.04 }}
      >
        <Trans>Voting rule</Trans>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {RULES.map((rule) => {
          const active = value === rule.id;
          return (
            <button
              key={rule.id}
              type="button"
              onClick={() => onChange(rule.id)}
              aria-pressed={active}
              className="flex flex-col items-start gap-1.5 rounded-xl p-3 text-left"
              style={{
                background: active ? 'var(--surface)' : 'var(--field-bg)',
                border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                cursor: 'pointer',
              }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border-hi)'}`,
                    background: active ? 'var(--ink)' : 'transparent',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {active && (
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 999,
                        background: 'var(--bg)',
                      }}
                    />
                  )}
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  {rule.title}
                </span>
              </div>
              <div className="text-[11.5px]" style={{ color: 'var(--ink-soft)', lineHeight: 1.4 }}>
                {rule.hint}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
