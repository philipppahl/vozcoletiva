import { Trans } from '@lingui/macro';
import { Link } from '@tanstack/react-router';

import type { DocumentSummary } from '../../lib/documents/types';
import { CategoryBadge } from '../categories/CategoryBadge';
import { Card } from '../ui/Card';

interface DocumentListProps {
  slug: string;
  documents: DocumentSummary[];
}

export function DocumentList({ slug, documents }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          <Trans>
            No documents yet. Documents appear here once a Document-type proposal passes.
          </Trans>
        </p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3 px-4">
      {documents.map((doc) => (
        <li key={doc.name}>
          <Card padded={false}>
            <Link
              to="/p/$slug/documents/$name"
              params={{ slug, name: encodeURIComponent(doc.name) }}
              search={{}}
              className="block p-4"
            >
              <div
                className="mb-1 text-[10.5px] font-semibold uppercase"
                style={{ color: 'var(--ink-muted)', letterSpacing: 0.06 }}
              >
                <Trans>v{doc.version_count}</Trans>
                {doc.current_version?.closed_at && (
                  <>
                    {' · '}
                    <time>
                      {new Date(doc.current_version.closed_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>
                  </>
                )}
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  fontWeight: 500,
                  lineHeight: 1.2,
                  color: 'var(--ink)',
                  letterSpacing: -0.25,
                  fontVariationSettings: '"opsz" 28',
                  margin: 0,
                }}
              >
                {doc.name}
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <CategoryBadge slug={slug} categoryId={doc.current_version?.category_id} />
                {doc.active_amendment && (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    <Trans>Amendment in progress</Trans>
                  </span>
                )}
              </div>
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}
