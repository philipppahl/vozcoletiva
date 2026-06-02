import { Trans } from '@lingui/macro';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { InboxList } from '../components/inbox/InboxList';
import { RequireAuth } from '../components/RequireAuth';
import { TopBar } from '../components/shell/TopBar';
import { useInbox, useMarkAllInboxRead } from '../lib/inbox';

export const Route = createFileRoute('/inbox')({
  component: () => (
    <RequireAuth>
      <InboxPage />
    </RequireAuth>
  ),
});

function InboxPage() {
  const navigate = useNavigate();
  const inbox = useInbox();
  const markAll = useMarkAllInboxRead();
  const unread = inbox.data?.unread_count ?? 0;

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <TopBar
        title={<Trans>Inbox</Trans>}
        onBack={() => void navigate({ to: '/' })}
        rightSlot={
          unread > 0 ? (
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="text-xs font-semibold"
              style={{
                color: 'var(--accent)',
                background: 'transparent',
                border: 'none',
                padding: 8,
                cursor: 'pointer',
              }}
            >
              <Trans>Mark all read</Trans>
            </button>
          ) : null
        }
      />
      <section className="flex flex-col pb-10">
        {inbox.isLoading && (
          <p className="px-4 pt-4 text-sm" style={{ color: 'var(--ink-soft)' }}>
            <Trans>Loading…</Trans>
          </p>
        )}
        {inbox.data && <InboxList items={inbox.data.items} />}
      </section>
    </div>
  );
}
