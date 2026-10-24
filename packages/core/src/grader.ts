// Rates a puzzle by solving it with the human-style techniques, easiest first.
// Difficulty = the hardest tier the solve needed; score = summed step weights, to rank within a tier.

import { applyStep, createBoard, findStep, type Step, type Technique } from './logic';
import { DIFFICULTIES, difficultyRank, type Difficulty, type Grid } from './types';

export const TECHNIQUE_TIER: Record<Technique, Difficulty> = {
  fullHouse: 'easy',
  hiddenSingle: 'easy',
  nakedSingle: 'medium',
  lockedCandidates: 'medium',
  nakedPair: 'hard',
  hiddenPair: 'hard',
  nakedTriple: 'hard',
  hiddenTriple: 'hard',
  xWing: 'expert',
  xyWing: 'expert',
  swordfish: 'expert',
};

export const TECHNIQUE_WEIGHT: Record<Technique, number> = {
  fullHouse: 4,
  hiddenSingle: 14,
  nakedSingle: 23,
  lockedCandidates: 50,
  nakedPair: 60,
  hiddenPair: 70,
  nakedTriple: 80,
  hiddenTriple: 100,
  xWing: 140,
  xyWing: 160,
  swordfish: 150,
};

export interface GradeResult {
  /** False when the known techniques get stuck before the grid is full. */
  solved: boolean;
  /** Null when unsolved: the puzzle needs techniques beyond our set (or guessing). */
  difficulty: Difficulty | null;
  score: number;
  steps: Step[];
  /** How often each technique was used. */
  usage: Partial<Record<Technique, number>>;
}

export interface GradeOptions {
  /** Stop as soon as a step harder than this tier is needed (used by the generator to save time). */
  maxDifficulty?: Difficulty;
}

export function grade(grid: Grid, options: GradeOptions = {}): GradeResult {
  const board = createBoard(grid);
  const steps: Step[] = [];
  const usage: Partial<Record<Technique, number>> = {};
  const cap =
    options.maxDifficulty === undefined ? Infinity : difficultyRank(options.maxDifficulty);
  let score = 0;
  let hardest = 0;

  while (board.values.includes(0)) {
    const next = findStep(board);
    if (!next) return { solved: false, difficulty: null, score, steps, usage };
    const rank = difficultyRank(TECHNIQUE_TIER[next.technique]);
    if (rank > cap) return { solved: false, difficulty: null, score, steps, usage };
    hardest = Math.max(hardest, rank);
    score += TECHNIQUE_WEIGHT[next.technique];
    usage[next.technique] = (usage[next.technique] ?? 0) + 1;
    steps.push(next);
    applyStep(board, next);
  }

  return { solved: true, difficulty: DIFFICULTIES[hardest]!, score, steps, usage };
}
