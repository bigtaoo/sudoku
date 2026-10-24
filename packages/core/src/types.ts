/** A digit placed in a cell. 0 is never a Digit; it marks an empty cell in a Grid. */
export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Row-major 9x9 board, 81 entries, 0 = empty. Index = row * 9 + col. */
export type Grid = number[];

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export function difficultyRank(d: Difficulty): number {
  return DIFFICULTIES.indexOf(d);
}
