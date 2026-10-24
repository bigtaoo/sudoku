import { isGridShape, PEERS } from './grid';
import type { Grid } from './types';

/** Indices of filled cells whose digit repeats in a row, column or box. */
export function findConflicts(grid: Grid): number[] {
  const out: number[] = [];
  for (let i = 0; i < 81; i++) {
    const v = grid[i];
    if (v && PEERS[i]!.some((p) => grid[p] === v)) out.push(i);
  }
  return out;
}

export function isComplete(grid: Grid): boolean {
  return grid.every((v) => v !== 0);
}

/**
 * True when `answer` is a full, conflict-free grid that keeps every given of `puzzle`.
 * For a unique-solution puzzle that is exactly its solution, so the server can verify
 * a submission without storing the solution.
 */
export function isValidSolution(puzzle: Grid, answer: unknown): answer is Grid {
  if (!isGridShape(answer) || !isComplete(answer)) return false;
  for (let i = 0; i < 81; i++) if (puzzle[i] && puzzle[i] !== answer[i]) return false;
  return findConflicts(answer).length === 0;
}
