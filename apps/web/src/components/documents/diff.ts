/**
 * Line-level diff via longest-common-subsequence. No external dependency.
 * Returns a sequence of rows annotated as context / add / remove, with
 * per-row line numbers (1-based) keyed to whichever side the row exists on.
 *
 * Edge cases:
 *   - both inputs empty → []
 *   - identical inputs → all context rows
 *   - whole-replace → all removes followed by all adds
 *
 * The implementation runs O(N*M) memory; fine for the document sizes we
 * expect (statutes / code of conduct ≲ a few hundred lines).
 */

export type DiffRow =
  | { kind: 'context'; beforeLine: number; afterLine: number; text: string }
  | { kind: 'remove'; beforeLine: number; text: string }
  | { kind: 'add'; afterLine: number; text: string };

export function diffLines(before: string, after: string): DiffRow[] {
  const a = before.length === 0 ? [] : before.split('\n');
  const b = after.length === 0 ? [] : after.split('\n');
  const lcs = buildLcsTable(a, b);
  return backtrack(a, b, lcs);
}

function buildLcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }
  return dp;
}

function backtrack(a: string[], b: string[], dp: number[][]): DiffRow[] {
  const rows: DiffRow[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      rows.push({
        kind: 'context',
        beforeLine: i,
        afterLine: j,
        text: a[i - 1]!,
      });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      rows.push({ kind: 'add', afterLine: j, text: b[j - 1]! });
      j -= 1;
    } else if (i > 0) {
      rows.push({ kind: 'remove', beforeLine: i, text: a[i - 1]! });
      i -= 1;
    } else {
      break;
    }
  }
  rows.reverse();
  return rows;
}
