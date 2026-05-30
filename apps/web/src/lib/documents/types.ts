import type { components } from '@vozcoletiva/api-client';

/**
 * A "document" in the FE is a derived view over passed Document-kind proposals
 * (decision 0004). These alias the generated api-client schemas so they match
 * the wire shape exactly.
 */
export type DocumentSummary = components['schemas']['DocumentSummary'];
export type DocumentDetail = components['schemas']['DocumentDetail'];
export type DocumentListResponse = components['schemas']['DocumentListResponse'];
