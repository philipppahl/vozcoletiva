import { Trans } from '@lingui/macro';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { CategoryChips } from '../components/categories/CategoryChips';
import { DocumentList } from '../components/documents/DocumentList';
import { RequireAuth } from '../components/RequireAuth';
import { ProjectShell } from '../components/shell/ProjectShell';
import { useCategories } from '../lib/categories';
import { useDocuments } from '../lib/documents';

interface CategoryFilterSearch {
  category?: string;
}

export const Route = createFileRoute('/p/$slug/documents')({
  component: () => (
    <RequireAuth>
      <DocumentsPage />
    </RequireAuth>
  ),
  validateSearch: (search): CategoryFilterSearch => ({
    category: typeof search.category === 'string' ? search.category : undefined,
  }),
});

function DocumentsPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const documents = useDocuments(slug);
  const categories = useCategories(slug);
  const filtered =
    documents.data && search.category
      ? documents.data.documents.filter((d) => d.current_version?.category_id === search.category)
      : documents.data?.documents;
  return (
    <ProjectShell
      slug={slug}
      tab="documents"
      pageTitle={<Trans>Documents</Trans>}
      subsection={
        categories.data ? (
          <CategoryChips
            categories={categories.data.categories}
            selected={search.category ?? null}
            onChange={(id) =>
              void navigate({
                to: '/p/$slug/documents',
                params: { slug },
                search: id ? { category: id } : {},
              })
            }
          />
        ) : undefined
      }
    >
      <div className="pt-4 pb-6">
        {documents.isLoading ? (
          <p className="px-4 text-sm" style={{ color: 'var(--ink-soft)' }}>
            <Trans>Loading documents…</Trans>
          </p>
        ) : filtered ? (
          <DocumentList slug={slug} documents={filtered} />
        ) : null}
      </div>
    </ProjectShell>
  );
}
