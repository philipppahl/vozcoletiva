import { Trans } from '@lingui/macro';

import type { InboxItem } from '../../lib/inbox/types';
import { InboxItemRow } from './InboxItemRow';

interface InboxListProps {
  items: InboxItem[];
}

export function InboxList({ items }: InboxListProps) {
  if (items.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          <Trans>
            Nothing waiting for you. Mentions, replies, comments on your proposals, and deliberation
            results will land here.
          </Trans>
        </p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <InboxItemRow key={item.id} item={item} />
      ))}
    </ul>
  );
}
