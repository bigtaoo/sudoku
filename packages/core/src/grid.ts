import type { Grid } from './types';

export const CELL_COUNT = 81;

export const ROW_OF: readonly number[] = Array.from({ length: 81 }, (_, i) => Math.floor(i / 9));
export const COL_OF: readonly number[] = Array.from({ length: 81 }, (_, i) => i % 9);
export const BOX_OF: readonly number[] = Array.from(
  { length: 81 },
  (_, i) => Math.floor(ROW_OF[i]! / 3) * 3 + Math.floor(COL_OF[i]! / 3),
);

export const ROWS: readonly (readonly number[])[] = Array.from({ length: 9 }, (_, r) =>
  Array.from({ length: 9 }, (_, c) => r * 9 + c),
);
export const COLS: readonly (readonly number[])[] = Array.from({ length: 9 }, (_, c) =>
  Array.from({ length: 9 }, (_, r) => r * 9 + c),
);
export const BOXES: readonly (readonly number[])[] = Array.from({ length: 9 }, (_, b) =>
  Array.from(
    { length: 9 },
    (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3),
  ),
);

/** All 27 houses: rows 0-8, columns 9-17, boxes 18-26. */
export const UNITS: readonly (readonly number[])[] = [...ROWS, ...COLS, ...BOXES];

/** The 20 cells sharing a row, column or box with each cell. */
export const PEERS: readonly (readonly number[])[] = Array.from({ length: 81 }, (_, i) => {
  const set = new Set<number>([...ROWS[ROW_OF[i]!]!, ...COLS[COL_OF[i]!]!, ...BOXES[BOX_OF[i]!]!]);
  set.delete(i);
  return [...set];
});

export function sees(a: number, b: number): boolean {
  return a !== b && (ROW_OF[a] === ROW_OF[b] || COL_OF[a] === COL_OF[b] || BOX_OF[a] === BOX_OF[b]);
}

export function emptyGrid(): Grid {
  return new Array<number>(81).fill(0);
}

/**
 * Parses an 81-character string. Digits 1-9 are givens; '0' or '.' are empty.
 * Whitespace is ignored so multi-line layouts work.
 */
export function parseGrid(text: string): Grid {
  const chars = text.replace(/\s+/g, '');
  if (chars.length !== 81) throw new Error(`Expected 81 cells, got ${chars.length}`);
  return [...chars].map((ch) => {
    if (ch === '.' || ch === '0') return 0;
    const d = Number(ch);
    if (!Number.isInteger(d) || d < 1 || d > 9) throw new Error(`Invalid cell character '${ch}'`);
    return d;
  });
}

export function gridToString(grid: Grid, empty = '.'): string {
  return grid.map((v) => (v === 0 ? empty : String(v))).join('');
}

export function isGridShape(value: unknown): value is Grid {
  return (
    Array.isArray(value) &&
    value.length === 81 &&
    value.every((v) => Number.isInteger(v) && v >= 0 && v <= 9)
  );
}

export function countClues(grid: Grid): number {
  return grid.reduce((n, v) => n + (v ? 1 : 0), 0);
}
