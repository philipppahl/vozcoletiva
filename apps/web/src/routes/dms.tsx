import { Trans } from '@lingui/macro';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { DmListSection } from '../components/messages/DmListSection';
import { MemberPickerSheet } from '../components/messages/MemberPickerSheet';
import { RequireAuth } from '../components/RequireAuth';
import { TopBar } from '../components/shell/TopBar';
import { useDms } from '../lib/messages';

export const Route = createFileRoute('/dms')({
  component: () => (
    <RequireAuth>
      <DmsIndex />
    </RequireAuth>
  ),
});

function DmsIndex() {
  const navigate = useNavigate();
  const dms = useDms();
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <TopBar title={<Trans>Direct messages</Trans>} onBack={() => void navigate({ to: '/' })} />
      <DmListSection dms={dms.data?.dms ?? []} onStartDm={() => setPickerOpen(true)} />
      <MemberPickerSheet open={pickerOpen} onOpenChange={setPickerOpen} />
    </div>
  );
}
