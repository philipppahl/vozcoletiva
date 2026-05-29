import { Trans } from '@lingui/macro';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import type { SearchResponse } from '../../lib/search/types';
import { ChannelRow, DocumentRow, MemberRow, ProposalRow } from './SearchResultRow';

interface SearchResultsProps {
  slug: string;
  data: SearchResponse | undefined;
  rawQuery: string;
  isPending: boolean;
}

export function SearchResults({ slug, data, rawQuery, isPending }: SearchResultsProps) {
  const trimmed = rawQuery.trim();
  if (trimmed.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
        <Trans>Search proposals, documents, members and channels in this project.</Trans>
      </p>
    );
  }
  if (trimmed.length < 2) {
    return (
      <p className="px-6 py-10 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
        <Trans>Type at least 2 characters.</Trans>
      </p>
    );
  }
  if (!data) {
    return (
      <p className="px-6 py-10 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
        <Trans>Searching…</Trans>
      </p>
    );
  }
  const { sections } = data;
  const totalHits =
    sections.proposals.hits.length +
    sections.documents.hits.length +
    sections.members.hits.length +
    sections.channels.hits.length;
  if (totalHits === 0) {
    return (
      <p
        className="px-6 py-10 text-center text-sm"
        style={{ color: 'var(--ink-soft)', opacity: isPending ? 0.5 : 1 }}
      >
        <Trans>No results for "{trimmed}".</Trans>
      </p>
    );
  }
  return (
    <div className="mt-4 flex flex-col gap-6" style={{ opacity: isPending ? 0.6 : 1 }}>
      <Section
        title={<Trans>Proposals</Trans>}
        seeAll={sections.proposals.has_more ? <SeeAll to="/p/$slug" slug={slug} /> : null}
        empty={sections.proposals.hits.length === 0}
      >
        {sections.proposals.hits.map((h) => (
          <ProposalRow key={h.id} slug={slug} hit={h} />
        ))}
      </Section>
      <Section
        title={<Trans>Documents</Trans>}
        seeAll={sections.documents.has_more ? <SeeAll to="/p/$slug/documents" slug={slug} /> : null}
        empty={sections.documents.hits.length === 0}
      >
        {sections.documents.hits.map((h) => (
          <DocumentRow key={h.name} slug={slug} hit={h} />
        ))}
      </Section>
      <Section
        title={<Trans>Members</Trans>}
        seeAll={sections.members.has_more ? <SeeAll to="/p/$slug/members" slug={slug} /> : null}
        empty={sections.members.hits.length === 0}
      >
        {sections.members.hits.map((h) => (
          <MemberRow key={h.user_id} slug={slug} hit={h} />
        ))}
      </Section>
      <Section
        title={<Trans>Channels</Trans>}
        seeAll={sections.channels.has_more ? <SeeAll to="/p/$slug/messages" slug={slug} /> : null}
        empty={sections.channels.hits.length === 0}
      >
        {sections.channels.hits.map((h) => (
          <ChannelRow key={h.id} slug={slug} hit={h} />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  seeAll,
  empty,
  children,
}: {
  title: ReactNode;
  seeAll: ReactNode;
  empty: boolean;
  children: ReactNode;
}) {
  if (empty) return null;
  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between px-4">
        <h3
          className="text-[10.5px] font-semibold uppercase"
          style={{ color: 'var(--ink-muted)', letterSpacing: 0.06 }}
        >
          {title}
        </h3>
        {seeAll}
      </div>
      <div
        style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 14,
        }}
        className="mx-4 overflow-hidden"
      >
        {children}
      </div>
    </section>
  );
}

function SeeAll({
  to,
  slug,
}: {
  to: '/p/$slug' | '/p/$slug/documents' | '/p/$slug/members' | '/p/$slug/messages';
  slug: string;
}) {
  return (
    <Link
      to={to}
      params={{ slug }}
      className="text-[11px] font-semibold"
      style={{ color: 'var(--accent)' }}
    >
      <Trans>See all →</Trans>
    </Link>
  );
}
