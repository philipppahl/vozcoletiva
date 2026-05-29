import { Avatar } from '../shell/Avatar';

export interface MentionCandidate {
  user_id: string;
  display_name: string;
}

interface MentionPopoverProps {
  candidates: MentionCandidate[];
  /** Active index (highlighted, picked when the user hits Enter). */
  active: number;
  onPick: (c: MentionCandidate) => void;
  onHover: (index: number) => void;
}

export function MentionPopover({ candidates, active, onPick, onHover }: MentionPopoverProps) {
  if (candidates.length === 0) return null;
  return (
    <div
      role="listbox"
      className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl"
      style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        maxHeight: 220,
        overflowY: 'auto',
        zIndex: 12,
      }}
    >
      {candidates.map((c, i) => {
        const isActive = i === active;
        return (
          <div key={c.user_id}>
            <button
              type="button"
              role="option"
              aria-selected={isActive}
              onMouseEnter={() => onHover(i)}
              onMouseDown={(e) => {
                // mouseDown rather than click so the textarea doesn't lose
                // focus before we insert the mention.
                e.preventDefault();
                onPick(c);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left"
              style={{
                background: isActive ? 'var(--surface-2)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Avatar displayName={c.display_name} size={24} />
              <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                {c.display_name}
              </span>
              <span className="ml-auto font-mono text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                @{c.user_id}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
