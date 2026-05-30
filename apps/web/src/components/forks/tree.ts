import type { ExtendedProposal } from '../../lib/proposals/types';

export interface TreeRow {
  proposal: ExtendedProposal;
  /** Depth from root: 0 for root, 1 for direct child, … */
  depth: number;
  /** True if this row is the last sibling at its depth. */
  isLast: boolean;
  /**
   * For each ancestor depth, was that ancestor the last sibling? Used by the
   * renderer to decide whether to draw a `│` connector at that column or a
   * blank space.
   *
   * `ancestorLasts[0]` is the root's own isLast value (always true) and is
   * effectively ignored by the renderer.
   */
  ancestorLasts: boolean[];
}

export function rootOf(proposal: ExtendedProposal, all: ExtendedProposal[]): ExtendedProposal {
  let cursor: ExtendedProposal | undefined = proposal;
  for (let i = 0; i < 32 && cursor?.parent_id; i += 1) {
    const next = all.find((x) => x.id === cursor!.parent_id);
    if (!next) break;
    cursor = next;
  }
  return cursor ?? proposal;
}

export function childrenOf(parentId: string, all: ExtendedProposal[]): ExtendedProposal[] {
  return all
    .filter((p) => p.parent_id === parentId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Depth-first flat tree starting at `rootId`. Each entry carries enough
 * metadata for a box-drawing renderer to draw the right connectors.
 */
export function treeRows(rootId: string, all: ExtendedProposal[]): TreeRow[] {
  const rows: TreeRow[] = [];
  const visit = (id: string, depth: number, isLast: boolean, ancestorLasts: boolean[]) => {
    const node = all.find((x) => x.id === id);
    if (!node) return;
    rows.push({ proposal: node, depth, isLast, ancestorLasts });
    const kids = childrenOf(id, all);
    kids.forEach((c, i) => {
      visit(c.id, depth + 1, i === kids.length - 1, [...ancestorLasts, isLast]);
    });
  };
  visit(rootId, 0, true, []);
  return rows;
}

export function treeFlat(rootId: string, all: ExtendedProposal[]): ExtendedProposal[] {
  return treeRows(rootId, all).map((r) => r.proposal);
}

/**
 * Revision tags for a deliberation tree. When two or more alternatives share
 * the same title (someone kept the title when forking/amending), they're hard
 * to tell apart — so we tag each with `(r1)`, `(r2)`, … in creation order
 * (the original is r1). Titles that are unique within the tree get `null`
 * (no tag needed). Returns a map from proposal id → tag string or null.
 */
export function revisionTags(tree: ExtendedProposal[]): Record<string, string | null> {
  const byTitle = new Map<string, ExtendedProposal[]>();
  for (const p of tree) {
    const key = p.title.trim().toLowerCase();
    const bucket = byTitle.get(key);
    if (bucket) bucket.push(p);
    else byTitle.set(key, [p]);
  }
  const out: Record<string, string | null> = {};
  for (const bucket of byTitle.values()) {
    if (bucket.length < 2) {
      for (const p of bucket) out[p.id] = null;
      continue;
    }
    const ordered = [...bucket].sort(
      (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    );
    ordered.forEach((p, i) => {
      out[p.id] = `(r${i + 1})`;
    });
  }
  return out;
}

/**
 * Pre-rendered box-drawing prefix for one row: `'├─ '`, `'└─ '`, with
 * leading `'│  '` / `'   '` columns reflecting `ancestorLasts`.
 */
export function rowPrefix(row: TreeRow): string {
  if (row.depth === 0) return '';
  let prefix = '';
  // Columns 1..depth-1: each column draws `│  ` if the matching ancestor is
  // NOT the last sibling at its level; otherwise blank.
  for (let c = 1; c < row.depth; c += 1) {
    prefix += row.ancestorLasts[c] ? '   ' : '│  ';
  }
  prefix += row.isLast ? '└─ ' : '├─ ';
  return prefix;
}
