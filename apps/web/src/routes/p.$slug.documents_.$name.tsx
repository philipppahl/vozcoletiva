import { Trans } from '@lingui/macro';
import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useMemo } from 'react';
import { DiffView } from '../components/documents/DiffView';
import { diffLines } from '../components/documents/diff';
import { Markdown } from '../components/Markdown';
import { RequireAuth } from '../components/RequireAuth';
import { ProjectShell } from '../components/shell/ProjectShell';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useDocument } from '../lib/documents';

interface DocumentSearch {
  version?: string;
  diff?: string;
}

export const Route = createFileRoute('/p/$slug/documents_/$name')({
  component: () => (
    <RequireAuth>
      <DocumentDetailPage />
    </RequireAuth>
  ),
  validateSearch: (search): DocumentSearch => ({
    version: typeof search.version === 'string' ? search.version : undefined,
    diff: typeof search.diff === 'string' ? search.diff : undefined,
  }),
});

function DocumentDetailPage() {
  const { slug, name } = Route.useParams();
  const decodedName = decodeURIComponent(name);
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const doc = useDocument(slug, decodedName);

  const viewingVersion = useMemo(() => {
    if (!doc.data) return null;
    if (!search.version) return doc.data.current_version;
    return doc.data.versions.find((v) => v.id === search.version) ?? doc.data.current_version;
  }, [doc.data, search.version]);

  const diffAgainst = useMemo(() => {
    if (!doc.data || !search.diff) return null;
    return doc.data.versions.find((v) => v.id === search.diff) ?? null;
  }, [doc.data, search.diff]);

  const diffRows = useMemo(() => {
    if (!viewingVersion || !diffAgainst) return [];
    return diffLines(diffAgainst.body, viewingVersion.body);
  }, [viewingVersion, diffAgainst]);

  return (
    <ProjectShell
      slug={slug}
      tab="documents"
      pageTitle={decodedName}
      onBack={() =>
        router.history.canGoBack()
          ? router.history.back()
          : navigate({ to: '/p/$slug/documents', params: { slug } })
      }
    >
      <section className="flex flex-col gap-5 px-4 pt-5 pb-28">
        {doc.isLoading && (
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            <Trans>Loading…</Trans>
          </p>
        )}
        {doc.data && viewingVersion && (
          <>
            <Card padded={false}>
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span
                  className="text-[11px] font-semibold uppercase"
                  style={{ color: 'var(--ink-muted)', letterSpacing: 0.06 }}
                >
                  <Trans>Version</Trans>
                </span>
                <VersionRow
                  doc={doc.data}
                  selected={viewingVersion.id}
                  diff={diffAgainst?.id ?? null}
                  slug={slug}
                  name={decodedName}
                />
                {doc.data.active_amendment && (
                  <span
                    className="ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    <Trans>Amendment in progress</Trans>
                  </span>
                )}
              </div>
            </Card>

            {doc.data.active_amendment && (
              <Card>
                <div className="flex flex-col gap-2">
                  <div
                    className="text-[11px] font-semibold uppercase"
                    style={{ color: 'var(--accent)', letterSpacing: 0.06 }}
                  >
                    <Trans>Open deliberation</Trans>
                  </div>
                  <Link
                    to="/p/$slug/proposals/$id"
                    params={{ slug, id: doc.data.active_amendment.id }}
                    className="text-base font-medium"
                    style={{ color: 'var(--ink)' }}
                  >
                    {doc.data.active_amendment.title}
                  </Link>
                </div>
              </Card>
            )}

            {diffAgainst ? (
              <DiffView rows={diffRows} />
            ) : (
              <article>
                <Markdown source={viewingVersion.body} />
              </article>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                {viewingVersion.closed_at && (
                  <Trans>
                    Passed{' '}
                    {new Date(viewingVersion.closed_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Trans>
                )}
              </span>
              {!doc.data.active_amendment && (
                <Link
                  to="/p/$slug/proposals/new"
                  params={{ slug }}
                  search={{ amends: decodedName }}
                >
                  <Button variant="primary" size="sm">
                    <Trans>Propose amendment</Trans>
                  </Button>
                </Link>
              )}
            </div>
          </>
        )}
      </section>
    </ProjectShell>
  );
}

function VersionRow({
  doc,
  selected,
  diff,
  slug,
  name,
}: {
  doc: { versions: Array<{ id: string; closed_at?: string | null }> };
  selected: string;
  diff: string | null;
  slug: string;
  name: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {doc.versions.map((v, idx) => {
        const num = doc.versions.length - idx;
        const isSelected = v.id === selected;
        return (
          <Link
            key={v.id}
            to="/p/$slug/documents/$name"
            params={{ slug, name: encodeURIComponent(name) }}
            search={isSelected && diff !== v.id ? { diff: v.id } : { version: v.id }}
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
            style={{
              background: isSelected ? 'var(--ink)' : 'var(--surface-2)',
              color: isSelected ? 'var(--bg)' : 'var(--ink-soft)',
              cursor: 'pointer',
            }}
            aria-pressed={isSelected}
          >
            v{num}
          </Link>
        );
      })}
      {diff && (
        <Link
          to="/p/$slug/documents/$name"
          params={{ slug, name: encodeURIComponent(name) }}
          search={{ version: selected }}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium underline"
          style={{ color: 'var(--ink-muted)', textUnderlineOffset: 3 }}
        >
          <Trans>Hide diff</Trans>
        </Link>
      )}
    </div>
  );
}
