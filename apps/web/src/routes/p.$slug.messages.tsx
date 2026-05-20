import { Trans } from '@lingui/macro';
import { createFileRoute } from '@tanstack/react-router';

import { PlannedPlaceholder } from '../components/PlannedPlaceholder';
import { RequireAuth } from '../components/RequireAuth';
import { ProjectShell } from '../components/shell/ProjectShell';

export const Route = createFileRoute('/p/$slug/messages')({
  component: () => (
    <RequireAuth>
      <MessagesPage />
    </RequireAuth>
  ),
});

function MessagesPage() {
  const { slug } = Route.useParams();
  return (
    <ProjectShell slug={slug} tab="messages" pageTitle={<Trans>Messages</Trans>}>
      <div className="px-4 pt-4 pb-6">
        <PlannedPlaceholder
          body={
            <Trans>
              Per-project channels for fast, informal talk. Text, images and voice notes. Not a
              replacement for deliberation — just lighter chatter alongside it.
            </Trans>
          }
        />
      </div>
    </ProjectShell>
  );
}
