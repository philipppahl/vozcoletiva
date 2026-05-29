import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import type {
  ChannelSearchHit,
  DocumentSearchHit,
  MemberSearchHit,
  ProposalSearchHit,
} from '../../lib/search/types';
import { Avatar } from '../shell/Avatar';

interface ProposalRowProps {
  slug: string;
  hit: ProposalSearchHit;
}

export function ProposalRow({ slug, hit }: ProposalRowProps) {
  return (
    <Link
      to="/p/$slug/proposals/$id"
      params={{ slug, id: hit.id }}
      className="block px-4 py-2.5"
      style={{
        borderBottom: '0.5px solid var(--border)',
        color: 'var(--ink)',
      }}
    >
      <RowHeader title={hit.title} eyebrow={statusLabel(hit.status)} />
      <p className="mt-1 truncate text-[12.5px]" style={{ color: 'var(--ink-soft)' }}>
        {hit.snippet}
      </p>
    </Link>
  );
}

interface DocumentRowProps {
  slug: string;
  hit: DocumentSearchHit;
}

export function DocumentRow({ slug, hit }: DocumentRowProps) {
  return (
    <Link
      to="/p/$slug/documents/$name"
      params={{ slug, name: encodeURIComponent(hit.name) }}
      className="block px-4 py-2.5"
      style={{
        borderBottom: '0.5px solid var(--border)',
        color: 'var(--ink)',
      }}
    >
      <RowHeader title={hit.name} eyebrow={`v${hit.version_count}`} />
      <p className="mt-1 truncate text-[12.5px]" style={{ color: 'var(--ink-soft)' }}>
        {hit.snippet}
      </p>
    </Link>
  );
}

interface MemberRowProps {
  slug: string;
  hit: MemberSearchHit;
}

export function MemberRow({ slug, hit }: MemberRowProps) {
  return (
    <Link
      to="/p/$slug/members"
      params={{ slug }}
      className="flex items-center gap-3 px-4 py-2.5"
      style={{
        borderBottom: '0.5px solid var(--border)',
        color: 'var(--ink)',
      }}
    >
      <Avatar displayName={hit.display_name} size={32} ring="var(--surface)" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium" style={{ color: 'var(--ink)' }}>
          {hit.display_name}
        </div>
        <div className="text-[11px] uppercase" style={{ color: 'var(--ink-muted)' }}>
          {hit.role}
        </div>
      </div>
    </Link>
  );
}

interface ChannelRowProps {
  slug: string;
  hit: ChannelSearchHit;
}

export function ChannelRow({ slug, hit }: ChannelRowProps) {
  return (
    <Link
      to="/p/$slug/messages/$channelId"
      params={{ slug, channelId: hit.id }}
      className="block px-4 py-2.5"
      style={{
        borderBottom: '0.5px solid var(--border)',
        color: 'var(--ink)',
      }}
    >
      <RowHeader title={`#${hit.name}`} />
      {hit.description && (
        <p className="mt-1 truncate text-[12.5px]" style={{ color: 'var(--ink-soft)' }}>
          {hit.description}
        </p>
      )}
    </Link>
  );
}

function RowHeader({ title, eyebrow }: { title: string; eyebrow?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <div className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: 'var(--ink)' }}>
        {title}
      </div>
      {eyebrow && (
        <span
          className="flex-shrink-0 text-[10.5px] font-semibold uppercase"
          style={{ color: 'var(--ink-muted)', letterSpacing: 0.04 }}
        >
          {eyebrow}
        </span>
      )}
    </div>
  );
}

function statusLabel(status: ProposalSearchHit['status']): string {
  switch (status) {
    case 'voting':
      return 'voting';
    case 'passed':
      return 'passed';
    case 'rejected':
      return 'rejected';
    case 'quorum_failed':
      return 'no quorum';
    case 'withdrawn':
      return 'withdrawn';
  }
}
