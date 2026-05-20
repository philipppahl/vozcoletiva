import { Trans } from '@lingui/macro';
import { createFileRoute } from '@tanstack/react-router';

import { PlannedPlaceholder } from '../components/PlannedPlaceholder';
import { RequireAuth } from '../components/RequireAuth';
import { ProjectShell } from '../components/shell/ProjectShell';

export const Route = createFileRoute('/p/$slug/documents')({
  component: () => (
    <RequireAuth>
      <DocumentsPage />
    </RequireAuth>
  ),
});

function DocumentsPage() {
  const { slug } = Route.useParams();
  return (
    <ProjectShell slug={slug} tab="documents" pageTitle={<Trans>Documents</Trans>}>
      <div className="px-4 pt-4 pb-6">
        <PlannedPlaceholder
          body={
            <Trans>
              Document proposals will become versioned canonical texts — statutes, by-laws,
              policies. Amendments diff against prior versions.
            </Trans>
          }
        />
      </div>
    </ProjectShell>
  );
}
