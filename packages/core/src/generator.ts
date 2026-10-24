// Puzzle generation: build a random full grid, then remove clues in symmetric pairs while the
// puzzle stays uniquely solvable AND solvable with techniques no harder than the target tier.
// Attempts that end up too easy are retried with a fresh grid from the same seeded stream.

import { grade } from './grader';
import { countClues } from './grid';
import { createRng, randomSeed, shuffle, toSeed } from './rng';
import { hasUniqueSolution, randomSolvedGrid } from './solver';
import { difficultyRank, type Difficulty, type Grid } from './types';

/** Floors keep easy puzzles feeling easy; harder tiers mostly get their difficulty from the grader. */
export const MIN_CLUES: Record<Difficulty, number> = {
  easy: 36,
  medium: 30,
  hard: 25,
  expert: 22,
};

export interface GenerateOptions {
  difficulty: Difficulty;
  /** Same seed + difficulty always yields the same puzzle (e.g. "2026-10-24" for the daily). */
  seed?: number | string;
  /** Full grids to try before settling for the hardest puzzle found below the target tier. */
  maxAttempts?: number;
}

export interface GeneratedPuzzle {
  puzzle: Grid;
  solution: Grid;
  /** Actual tier; lower than requested only if every attempt fell short. */
  difficulty: Difficulty;
  score: number;
  clues: number;
  seed: number;
}

export function generatePuzzle({
  difficulty,
  seed,
  maxAttempts = 200,
}: GenerateOptions): GeneratedPuzzle {
  const numericSeed = toSeed(seed ?? randomSeed());
  const rng = createRng(numericSeed);
  const minClues = MIN_CLUES[difficulty];
  let best: GeneratedPuzzle | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = randomSolvedGrid(rng);
    const puzzle = solution.slice();
    let clues = 81;

    // Cells 0..40 paired with their 180° rotation (80 - i); 40 is the centre and pairs with itself.
    const order = shuffle(
      Array.from({ length: 41 }, (_, i) => i),
      rng,
    );
    for (const i of order) {
      const j = 80 - i;
      const removed = i === j ? 1 : 2;
      if (clues - removed < minClues) continue;
      const a = puzzle[i]!;
      const b = puzzle[j]!;
      puzzle[i] = 0;
      puzzle[j] = 0;
      if (hasUniqueSolution(puzzle) && grade(puzzle, { maxDifficulty: difficulty }).solved) {
        clues -= removed;
      } else {
        puzzle[i] = a;
        puzzle[j] = b;
      }
    }

    const result = grade(puzzle);
    // Every kept removal was graded solvable at or below the target, so this always holds.
    if (!result.solved || !result.difficulty) continue;
    const candidate: GeneratedPuzzle = {
      puzzle,
      solution,
      difficulty: result.difficulty,
      score: result.score,
      clues: countClues(puzzle),
      seed: numericSeed,
    };
    if (result.difficulty === difficulty) return candidate;
    if (!best || difficultyRank(candidate.difficulty) > difficultyRank(best.difficulty))
      best = candidate;
  }

  if (!best) throw new Error('Puzzle generation failed');
  return best;
}
