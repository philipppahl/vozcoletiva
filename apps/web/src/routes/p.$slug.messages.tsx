import { Trans } from '@lingui/macro';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { ChannelListSection } from '../components/messages/ChannelListSection';
import { DmListSection } from '../components/messages/DmListSection';
import { MemberPickerSheet } from '../components/messages/MemberPickerSheet';
import { NewChannelSheet } from '../components/messages/NewChannelSheet';
import { RequireAuth } from '../components/RequireAuth';
import { ProjectShell } from '../components/shell/ProjectShell';
import { useChannels, useDms } from '../lib/messages';

export const Route = createFileRoute('/p/$slug/messages')({
  component: () => (
    <RequireAuth>
      <MessagesPage />
    </RequireAuth>
  ),
});

function MessagesPage() {
  const { slug } = Route.useParams();
  const channels = useChannels(slug);
  const dms = useDms();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newChannelOpen, setNewChannelOpen] = useState(false);

  return (
    <ProjectShell slug={slug} tab="messages" pageTitle={<Trans>Messages</Trans>}>
      <ChannelListSection
        slug={slug}
        channels={channels.data?.channels ?? []}
        onNewChannel={() => setNewChannelOpen(true)}
      />
      <DmListSection dms={dms.data?.dms ?? []} onStartDm={() => setPickerOpen(true)} />
      <MemberPickerSheet open={pickerOpen} onOpenChange={setPickerOpen} />
      <NewChannelSheet slug={slug} open={newChannelOpen} onOpenChange={setNewChannelOpen} />
      <div className="pb-24" />
    </ProjectShell>
  );
}
