import type { ExtendedProposal } from '../proposals/types';

/**
 * A "document" in the FE is a derived view. The server returns a snapshot
 * shaped like a Document, but every version IS a passed Document proposal.
 * See docs/decisions/0004-documents-mock-first.md.
 */
export interface DocumentSummary {
  name: string;
  version_count: number;
  current_version: ExtendedProposal | null;
  active_amendment: ExtendedProposal | null;
}

export interface DocumentDetail {
  name: string;
  version_count: number;
  current_version: ExtendedProposal;
  versions: ExtendedProposal[]; // newest first
  active_amendment: ExtendedProposal | null;
}

export interface DocumentListResponse {
  documents: DocumentSummary[];
}
