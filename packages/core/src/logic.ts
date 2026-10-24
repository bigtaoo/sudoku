// Human-style solving techniques. Each finder inspects a candidate board and returns the
// first deduction it can make, so the same code drives difficulty grading and in-game hints.

import { ALL_DIGITS, bit, digitsOf, onlyDigit, popcount } from './bits';
import { BOX_OF, BOXES, COL_OF, COLS, PEERS, ROW_OF, ROWS, sees, UNITS } from './grid';
import type { Digit, Grid } from './types';

export const TECHNIQUES = [
  'fullHouse',
  'hiddenSingle',
  'nakedSingle',
  'lockedCandidates',
  'nakedPair',
  'hiddenPair',
  'nakedTriple',
  'hiddenTriple',
  'xWing',
  'xyWing',
  'swordfish',
] as const;
export type Technique = (typeof TECHNIQUES)[number];

export interface CellDigit {
  cell: number;
  digit: Digit;
}

export interface Step {
  technique: Technique;
  /** Digits this step places. */
  placements: CellDigit[];
  /** Candidates this step removes. */
  eliminations: CellDigit[];
  /** Cells forming the pattern (for highlighting a hint). */
  pattern: number[];
  /** Digits the pattern is about. */
  digits: Digit[];
  /** House (index into UNITS) the deduction is based on, when there is one. */
  unit?: number;
}

export interface Board {
  values: Grid;
  /** Candidate mask per cell; 0 for filled cells. */
  cands: Uint16Array;
}

export function createBoard(grid: Grid): Board {
  const values = grid.slice();
  const cands = new Uint16Array(81);
  for (let i = 0; i < 81; i++) {
    if (values[i]) continue;
    let mask = ALL_DIGITS;
    for (const p of PEERS[i]!) mask &= ~bit(values[p]!);
    cands[i] = mask;
  }
  return { values, cands };
}

export function applyStep(board: Board, step: Step): void {
  for (const { cell, digit } of step.placements) {
    board.values[cell] = digit;
    board.cands[cell] = 0;
    for (const p of PEERS[cell]!) board.cands[p]! &= ~bit(digit);
  }
  for (const { cell, digit } of step.eliminations) board.cands[cell]! &= ~bit(digit);
}

function step(technique: Technique, parts: Partial<Omit<Step, 'technique'>>): Step {
  return {
    technique,
    placements: parts.placements ?? [],
    eliminations: parts.eliminations ?? [],
    pattern: parts.pattern ?? [],
    digits: parts.digits ?? [],
    ...(parts.unit === undefined ? {} : { unit: parts.unit }),
  };
}

function combinations<T>(items: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const pick: T[] = [];
  const walk = (start: number) => {
    if (pick.length === k) {
      out.push(pick.slice());
      return;
    }
    for (let i = start; i <= items.length - (k - pick.length); i++) {
      pick.push(items[i]!);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  return out;
}

function cellsWith(board: Board, unit: readonly number[], d: number): number[] {
  const b = bit(d);
  return unit.filter((i) => board.cands[i]! & b);
}

/** Eliminations of digit d from `targets`, skipping cells where d is already gone. */
function elimsOf(board: Board, targets: Iterable<number>, d: number): CellDigit[] {
  const b = bit(d);
  const out: CellDigit[] = [];
  for (const i of targets) if (board.cands[i]! & b) out.push({ cell: i, digit: d as Digit });
  return out;
}

// --- Singles ---------------------------------------------------------------

function findFullHouse(board: Board): Step | null {
  for (let u = 0; u < 27; u++) {
    const empty = UNITS[u]!.filter((i) => !board.values[i]);
    if (empty.length !== 1) continue;
    const cell = empty[0]!;
    const mask = board.cands[cell]!;
    if (popcount(mask) !== 1) continue;
    const digit = onlyDigit(mask);
    return step('fullHouse', {
      placements: [{ cell, digit }],
      pattern: [cell],
      digits: [digit],
      unit: u,
    });
  }
  return null;
}

function findHiddenSingle(board: Board): Step | null {
  // Boxes first: that is how most people scan, so hints read naturally.
  for (const u of [...range(18, 27), ...range(0, 18)]) {
    for (let d = 1; d <= 9; d++) {
      const cells = cellsWith(board, UNITS[u]!, d);
      if (cells.length !== 1) continue;
      const cell = cells[0]!;
      const digit = d as Digit;
      return step('hiddenSingle', {
        placements: [{ cell, digit }],
        pattern: [cell],
        digits: [digit],
        unit: u,
      });
    }
  }
  return null;
}

function findNakedSingle(board: Board): Step | null {
  for (let cell = 0; cell < 81; cell++) {
    const mask = board.cands[cell]!;
    if (board.values[cell] || popcount(mask) !== 1) continue;
    const digit = onlyDigit(mask);
    return step('nakedSingle', { placements: [{ cell, digit }], pattern: [cell], digits: [digit] });
  }
  return null;
}

// --- Intersections ---------------------------------------------------------

function findLockedCandidates(board: Board): Step | null {
  for (let d = 1; d <= 9; d++) {
    // Pointing: within a box, d is confined to one row/column -> remove it from the rest of that line.
    for (let b = 0; b < 9; b++) {
      const cells = cellsWith(board, BOXES[b]!, d);
      if (cells.length < 2) continue;
      for (const [lineOf, lines] of [
        [ROW_OF, ROWS],
        [COL_OF, COLS],
      ] as const) {
        const line = lineOf[cells[0]!]!;
        if (!cells.every((i) => lineOf[i] === line)) continue;
        const elims = elimsOf(
          board,
          lines[line]!.filter((i) => BOX_OF[i] !== b),
          d,
        );
        if (elims.length)
          return step('lockedCandidates', {
            eliminations: elims,
            pattern: cells,
            digits: [d as Digit],
            unit: 18 + b,
          });
      }
    }
    // Claiming: within a line, d is confined to one box -> remove it from the rest of that box.
    for (let u = 0; u < 18; u++) {
      const cells = cellsWith(board, UNITS[u]!, d);
      if (cells.length < 2) continue;
      const box = BOX_OF[cells[0]!]!;
      if (!cells.every((i) => BOX_OF[i] === box)) continue;
      const inLine = new Set(UNITS[u]);
      const elims = elimsOf(
        board,
        BOXES[box]!.filter((i) => !inLine.has(i)),
        d,
      );
      if (elims.length)
        return step('lockedCandidates', {
          eliminations: elims,
          pattern: cells,
          digits: [d as Digit],
          unit: u,
        });
    }
  }
  return null;
}

// --- Subsets ---------------------------------------------------------------

function findNakedSubset(board: Board, size: 2 | 3): Step | null {
  const technique = size === 2 ? 'nakedPair' : 'nakedTriple';
  for (let u = 0; u < 27; u++) {
    const unit = UNITS[u]!;
    const open = unit.filter((i) => !board.values[i]);
    if (open.length <= size) continue;
    const small = open.filter((i) => popcount(board.cands[i]!) <= size);
    for (const combo of combinations(small, size)) {
      const mask = combo.reduce((m, i) => m | board.cands[i]!, 0);
      if (popcount(mask) !== size) continue;
      const others = open.filter((i) => !combo.includes(i));
      const elims = digitsOf(mask).flatMap((d) => elimsOf(board, others, d));
      if (elims.length)
        return step(technique, {
          eliminations: elims,
          pattern: combo,
          digits: digitsOf(mask),
          unit: u,
        });
    }
  }
  return null;
}

function findHiddenSubset(board: Board, size: 2 | 3): Step | null {
  const technique = size === 2 ? 'hiddenPair' : 'hiddenTriple';
  for (let u = 0; u < 27; u++) {
    const unit = UNITS[u]!;
    const open = unit.filter((i) => !board.values[i]);
    if (open.length <= size) continue;
    const digits = range(1, 10).filter((d) => {
      const n = cellsWith(board, unit, d).length;
      return n >= 2 && n <= size;
    });
    for (const combo of combinations(digits, size)) {
      const cells = new Set(combo.flatMap((d) => cellsWith(board, unit, d)));
      if (cells.size !== size) continue;
      const keep = combo.reduce((m, d) => m | bit(d), 0);
      const elims: CellDigit[] = [];
      for (const i of cells)
        for (const d of digitsOf(board.cands[i]! & ~keep)) elims.push({ cell: i, digit: d });
      if (elims.length)
        return step(technique, {
          eliminations: elims,
          pattern: [...cells],
          digits: combo as Digit[],
          unit: u,
        });
    }
  }
  return null;
}

// --- Fish ------------------------------------------------------------------

function findFish(board: Board, size: 2 | 3): Step | null {
  const technique = size === 2 ? 'xWing' : 'swordfish';
  for (let d = 1; d <= 9; d++) {
    for (const [base, cover, coverOf] of [
      [ROWS, COLS, COL_OF],
      [COLS, ROWS, ROW_OF],
    ] as const) {
      const lines = range(0, 9)
        .map((k) => cellsWith(board, base[k]!, d))
        .filter((cells) => cells.length >= 2 && cells.length <= size);
      for (const combo of combinations(lines, size)) {
        const coverIdx = new Set(combo.flat().map((i) => coverOf[i]!));
        if (coverIdx.size !== size) continue;
        const pattern = new Set(combo.flat());
        const targets = [...coverIdx].flatMap((k) => cover[k]!.filter((i) => !pattern.has(i)));
        const elims = elimsOf(board, targets, d);
        if (elims.length)
          return step(technique, {
            eliminations: elims,
            pattern: [...pattern],
            digits: [d as Digit],
          });
      }
    }
  }
  return null;
}

// --- Wings -----------------------------------------------------------------

function findXyWing(board: Board): Step | null {
  const bivalue = range(0, 81).filter((i) => !board.values[i] && popcount(board.cands[i]!) === 2);
  for (const pivot of bivalue) {
    const pm = board.cands[pivot]!;
    const wings = bivalue.filter((i) => sees(pivot, i) && popcount(board.cands[i]! & pm) === 1);
    for (const [a, b] of combinations(wings, 2)) {
      const am = board.cands[a!]!;
      const bm = board.cands[b!]!;
      // Each wing shares a different pivot digit, and both share the same third digit z.
      if ((am & pm) === (bm & pm)) continue;
      const z = am & bm & ~pm;
      if (popcount(z) !== 1) continue;
      const d = onlyDigit(z);
      const targets = range(0, 81).filter((i) => i !== a && i !== b && sees(i, a!) && sees(i, b!));
      const elims = elimsOf(board, targets, d);
      if (elims.length)
        return step('xyWing', {
          eliminations: elims,
          pattern: [pivot, a!, b!],
          digits: digitsOf(pm | z),
        });
    }
  }
  return null;
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from }, (_, k) => from + k);
}

/** Finders in the order a person would usually try them; the first hit wins. */
const FINDERS: readonly ((board: Board) => Step | null)[] = [
  findFullHouse,
  findHiddenSingle,
  findNakedSingle,
  findLockedCandidates,
  (b) => findNakedSubset(b, 2),
  (b) => findHiddenSubset(b, 2),
  (b) => findNakedSubset(b, 3),
  (b) => findHiddenSubset(b, 3),
  (b) => findFish(b, 2),
  findXyWing,
  (b) => findFish(b, 3),
];

/** The easiest available deduction on this board, or null if none of the known techniques apply. */
export function findStep(board: Board): Step | null {
  for (const find of FINDERS) {
    const found = find(board);
    if (found) return found;
  }
  return null;
}

/**
 * Next logical step for a position, computing candidates from the placed digits alone.
 * The caller should make sure the position has no wrong digits first, or the hint may be bogus.
 */
export function findHint(grid: Grid): Step | null {
  return findStep(createBoard(grid));
}
