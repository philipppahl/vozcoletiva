export interface ProposalSearchHit {
  id: string;
  title: string;
  snippet: string;
  status: 'voting' | 'passed' | 'rejected' | 'quorum_failed' | 'withdrawn';
  proposal_kind: 'decision' | 'document';
}

export interface DocumentSearchHit {
  name: string;
  version_count: number;
  snippet: string;
}

export interface MemberSearchHit {
  user_id: string;
  display_name: string;
  role: string;
}

export interface ChannelSearchHit {
  id: string;
  name: string;
  description: string | null;
}

export interface SearchResultSections {
  proposals: { hits: ProposalSearchHit[]; has_more: boolean };
  documents: { hits: DocumentSearchHit[]; has_more: boolean };
  members: { hits: MemberSearchHit[]; has_more: boolean };
  channels: { hits: ChannelSearchHit[]; has_more: boolean };
}

export interface SearchResponse {
  query: string;
  sections: SearchResultSections;
}
