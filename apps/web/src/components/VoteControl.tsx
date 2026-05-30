import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import type { ReactElement } from 'react';
import { useState } from 'react';

import type { ExtendedProposal, VotingRule } from '../lib/proposals/types';
import { VOTE_ABSTAIN, VOTE_NONE } from '../lib/proposals/types';
import { Button } from './ui/Button';

interface VoteControlProps {
  /** All proposals in the deliberation tree (root + alternatives). */
  tree: ExtendedProposal[];
  /** The currently-viewed proposal. Used to highlight the "solo" pass option. */
  viewing: ExtendedProposal;
  /** Caller's current root-level choice, or null if unvoted. */
  myChoice: string | null;
  /** Voting rule for this deliberation (read off the root). */
  votingRule: VotingRule;
  /** Quorum, if any. */
  quorum: number | null | undefined;
  busy: boolean;
  onVote: (choice: string) => void;
  onRetract: () => void;
}

/**
 * One vote per deliberation. The voter picks one alternative, or
 * "none of these", or "abstain". For a solo proposal (no alternatives) the
 * two real options collapse into "Yes" / "No" labelled buttons, but the wire
 * shape is still pick-one — Yes = the proposal's own id, No = VOTE_NONE.
 *
 * See `docs/decisions/0005-voting-model-simplified.md` for the rationale.
 */
export function VoteControl({
  tree,
  viewing,
  myChoice,
  votingRule,
  quorum,
  busy,
  onVote,
  onRetract,
}: VoteControlProps) {
  const { _ } = useLingui();
  // The question root of a multi-option decision is not itself a choice — only
  // its option children are.
  const alternatives = tree.filter((p) => {
    if (p.is_question) return false;
    return p.parent_id || p.id === viewing.root_id;
  });
  // Order: root first (plain decision / fork tree), then children by creation.
  const ordered = [
    ...alternatives.filter((p) => !p.parent_id),
    ...alternatives
      .filter((p) => p.parent_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)),
  ];
  const isSolo = ordered.length === 1;
  const [pending, setPending] = useState<string | null>(null);

  function pick(choice: string) {
    setPending(choice);
    onVote(choice);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <RuleBadge rule={votingRule} />
        {quorum != null && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}
          >
            <Trans>Quorum {quorum}</Trans>
          </span>
        )}
      </div>

      {isSolo ? (
        <SoloButtons
          viewing={viewing}
          myChoice={myChoice}
          busy={busy || pending !== null}
          onVote={pick}
        />
      ) : (
        <AlternativesPicker
          ordered={ordered}
          myChoice={myChoice}
          busy={busy || pending !== null}
          onVote={pick}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={_(t`Abstain`)}
          onClick={() => pick(VOTE_ABSTAIN)}
          disabled={busy || pending !== null}
          className="text-sm font-medium underline"
          style={{
            color: myChoice === VOTE_ABSTAIN ? 'var(--ink)' : 'var(--ink-soft)',
            textUnderlineOffset: 4,
            textDecorationColor: myChoice === VOTE_ABSTAIN ? 'var(--ink)' : 'var(--border)',
            background: 'transparent',
            border: 'none',
            padding: 6,
            cursor: 'pointer',
          }}
        >
          {myChoice === VOTE_ABSTAIN ? '✓ ' : ''}
          <Trans>Abstain</Trans>
        </button>
        {myChoice && (
          <button
            type="button"
            onClick={onRetract}
            disabled={busy}
            className="text-xs underline"
            style={{
              color: 'var(--ink-muted)',
              textUnderlineOffset: 3,
              background: 'transparent',
              border: 'none',
              padding: 6,
              cursor: 'pointer',
            }}
          >
            <Trans>Retract</Trans>
          </button>
        )}
      </div>
    </div>
  );
}

function SoloButtons({
  viewing,
  myChoice,
  busy,
  onVote,
}: {
  viewing: ExtendedProposal;
  myChoice: string | null;
  busy: boolean;
  onVote: (choice: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant={myChoice === viewing.id ? 'yes' : 'secondary'}
        size="lg"
        onClick={() => onVote(viewing.id)}
        disabled={busy}
      >
        <Trans>Yes</Trans>
      </Button>
      <Button
        variant={myChoice === VOTE_NONE ? 'no' : 'secondary'}
        size="lg"
        onClick={() => onVote(VOTE_NONE)}
        disabled={busy}
      >
        <Trans>No</Trans>
      </Button>
    </div>
  );
}

function AlternativesPicker({
  ordered,
  myChoice,
  busy,
  onVote,
}: {
  ordered: ExtendedProposal[];
  myChoice: string | null;
  busy: boolean;
  onVote: (choice: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {ordered.map((p) => {
        const active = myChoice === p.id;
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onVote(p.id)}
              disabled={busy}
              aria-pressed={active}
              className="flex w-full items-start gap-3 rounded-xl p-3 text-left"
              style={{
                background: active ? 'var(--accent-soft)' : 'var(--surface)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer',
              }}
            >
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                style={{
                  background: active ? 'var(--accent)' : 'transparent',
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border-hi)'}`,
                }}
              >
                {active && (
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: 'var(--bg)',
                    }}
                  />
                )}
              </span>
              <span
                className="min-w-0 flex-1 text-sm font-medium"
                style={{ color: 'var(--ink)', lineHeight: 1.35 }}
              >
                {p.title}
              </span>
            </button>
          </li>
        );
      })}
      <li>
        <button
          type="button"
          onClick={() => onVote(VOTE_NONE)}
          disabled={busy}
          aria-pressed={myChoice === VOTE_NONE}
          className="flex w-full items-start gap-3 rounded-xl p-3 text-left"
          style={{
            background: myChoice === VOTE_NONE ? 'var(--surface-2)' : 'transparent',
            border: `1px dashed ${myChoice === VOTE_NONE ? 'var(--border-hi)' : 'var(--border)'}`,
            cursor: 'pointer',
          }}
        >
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
            style={{
              border: `1.5px solid ${myChoice === VOTE_NONE ? 'var(--ink)' : 'var(--border-hi)'}`,
              background: myChoice === VOTE_NONE ? 'var(--ink)' : 'transparent',
            }}
          >
            {myChoice === VOTE_NONE && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: 'var(--bg)',
                }}
              />
            )}
          </span>
          <span
            className="min-w-0 flex-1 text-sm font-medium"
            style={{ color: 'var(--ink-soft)', lineHeight: 1.35 }}
          >
            <Trans>None of these</Trans>
          </span>
        </button>
      </li>
    </ul>
  );
}

function RuleBadge({ rule }: { rule: VotingRule }) {
  const label: Record<VotingRule, ReactElement> = {
    plurality: <Trans>Plurality</Trans>,
    simple_majority: <Trans>Simple majority</Trans>,
    two_thirds: <Trans>Two-thirds</Trans>,
    consensus: <Trans>Consensus</Trans>,
  };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}
    >
      {label[rule]}
    </span>
  );
}
