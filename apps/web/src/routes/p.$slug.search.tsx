import { Trans } from '@lingui/macro';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { RequireAuth } from '../components/RequireAuth';
import { SearchInput } from '../components/search/SearchInput';
import { SearchResults } from '../components/search/SearchResults';
import { ProjectShell } from '../components/shell/ProjectShell';
import { useSearch } from '../lib/search';

export const Route = createFileRoute('/p/$slug/search')({
  component: () => (
    <RequireAuth>
      <SearchPage />
    </RequireAuth>
  ),
});

function SearchPage() {
  const { slug } = Route.useParams();
  const [query, setQuery] = useState('');
  const results = useSearch(slug, query);
  return (
    <ProjectShell slug={slug} tab="search" pageTitle={<Trans>Search</Trans>}>
      <SearchInput value={query} onChange={setQuery} autoFocus />
      <div className="pb-6">
        <SearchResults
          slug={slug}
          data={results.data}
          rawQuery={query}
          isPending={results.isFetching}
        />
      </div>
    </ProjectShell>
  );
}
