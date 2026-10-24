import { parseGrid } from '../src';

export const CLASSIC = parseGrid(
  '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79',
);
export const CLASSIC_SOLUTION = parseGrid(
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
);

/** Arto Inkala's 2012 "world's hardest sudoku": needs search, not just basic techniques. */
export const INKALA = parseGrid(
  '8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..',
);
