// Brute-force backtracking solver (bitmasks + minimum-remaining-values). Used for uniqueness
// checks and to build full grids; the human-style solver lives in logic.ts.

import { ALL_DIGITS, digitsOf, popcount } from './bits';
import { BOX_OF, COL_OF, ROW_OF } from './grid';
import { shuffle, type Rng } from './rng';
import type { Grid } from './types';

interface SearchResult {
  count: number;
  first: Grid | null;
}

function search(start: Grid, limit: number, rng?: Rng): SearchResult {
  const g = start.slice();
  const rowM = new Uint16Array(9);
  const colM = new Uint16Array(9);
  const boxM = new Uint16Array(9);

  for (let i = 0; i < 81; i++) {
    const v = g[i]!;
    if (!v) continue;
    const b = 1 << v;
    const r = ROW_OF[i]!;
    const c = COL_OF[i]!;
    const x = BOX_OF[i]!;
    if ((rowM[r]! | colM[c]! | boxM[x]!) & b) return { count: 0, first: null };
    rowM[r]! |= b;
    colM[c]! |= b;
    boxM[x]! |= b;
  }

  let count = 0;
  let first: Grid | null = null;

  // Returns true once `limit` solutions have been found, to unwind early.
  const recurse = (): boolean => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const mask = ALL_DIGITS & ~(rowM[ROW_OF[i]!]! | colM[COL_OF[i]!]! | boxM[BOX_OF[i]!]!);
      const n = popcount(mask);
      if (n === 0) return false;
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n === 1) break;
      }
    }

    if (best === -1) {
      count++;
      first ??= g.slice();
      return count >= limit;
    }

    const r = ROW_OF[best]!;
    const c = COL_OF[best]!;
    const x = BOX_OF[best]!;
    const digits = digitsOf(bestMask);
    if (rng) shuffle(digits, rng);
    for (const d of digits) {
      const b = 1 << d;
      g[best] = d;
      rowM[r]! |= b;
      colM[c]! |= b;
      boxM[x]! |= b;
      const done = recurse();
      rowM[r]! &= ~b;
      colM[c]! &= ~b;
      boxM[x]! &= ~b;
      g[best] = 0;
      if (done) return true;
    }
    return false;
  };

  recurse();
  return { count, first };
}

/** Number of solutions, capped at `limit` (default 2 is all a uniqueness check needs). */
export function countSolutions(grid: Grid, limit = 2): number {
  return search(grid, limit).count;
}

export function hasUniqueSolution(grid: Grid): boolean {
  return countSolutions(grid, 2) === 1;
}

/** Any solution of the grid, or null if it has none. */
export function solve(grid: Grid): Grid | null {
  return search(grid, 1).first;
}

/** A random completed grid; digit order is shuffled at every branch. */
export function randomSolvedGrid(rng: Rng): Grid {
  const result = search(new Array<number>(81).fill(0), 1, rng).first;
  if (!result) throw new Error('Unreachable: the empty grid always has a solution');
  return result;
}
