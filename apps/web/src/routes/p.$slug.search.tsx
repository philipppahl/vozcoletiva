import { Trans } from '@lingui/macro';
import { createFileRoute } from '@tanstack/react-router';

import { PlannedPlaceholder } from '../components/PlannedPlaceholder';
import { RequireAuth } from '../components/RequireAuth';
import { ProjectShell } from '../components/shell/ProjectShell';

export const Route = createFileRoute('/p/$slug/search')({
  component: () => (
    <RequireAuth>
      <SearchPage />
    </RequireAuth>
  ),
});

function SearchPage() {
  const { slug } = Route.useParams();
  return (
    <ProjectShell slug={slug} tab="search" pageTitle={<Trans>Search</Trans>}>
      <div className="px-4 pt-4 pb-6">
        <PlannedPlaceholder
          body={
            <Trans>
              Project-scoped search across proposals, people, and documents. Coming in a later
              slice.
            </Trans>
          }
        />
      </div>
    </ProjectShell>
  );
}
