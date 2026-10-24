import { describe, expect, it } from 'vitest';
import {
  bit,
  type Board,
  BOXES,
  COLS,
  createBoard,
  DIFFICULTIES,
  emptyGrid,
  findHint,
  findStep,
  generatePuzzle,
  grade,
  ROWS,
  type CellDigit,
} from '../src';
import { CLASSIC, CLASSIC_SOLUTION, INKALA } from './fixtures';

/** An empty board where every cell can still be anything; tests then carve out one pattern. */
function openBoard(): Board {
  return createBoard(emptyGrid());
}

function restrict(board: Board, cell: number, digits: number[]): void {
  board.cands[cell] = digits.reduce((m, d) => m | bit(d), 0);
}

function removeDigit(board: Board, cells: Iterable<number>, d: number): void {
  for (const i of cells) board.cands[i]! &= ~bit(d);
}

const byCell = (a: CellDigit, b: CellDigit) => a.cell - b.cell || a.digit - b.digit;

describe('technique finders', () => {
  it('hidden single: a digit with one home in a box', () => {
    const board = openBoard();
    removeDigit(
      board,
      BOXES[4]!.filter((i) => i !== 40),
      8,
    );
    const s = findStep(board)!;
    expect(s.technique).toBe('hiddenSingle');
    expect(s.placements).toEqual([{ cell: 40, digit: 8 }]);
    expect(s.unit).toBe(18 + 4);
  });

  it('naked single: a cell with one candidate', () => {
    const board = openBoard();
    restrict(board, 30, [6]);
    // Keep 6 alive elsewhere in every house of cell 30 so it is not also a hidden single.
    const s = findStep(board)!;
    expect(s.technique).toBe('nakedSingle');
    expect(s.placements).toEqual([{ cell: 30, digit: 6 }]);
  });

  it('locked candidates (pointing): box digit confined to one row', () => {
    const board = openBoard();
    removeDigit(board, [9, 10, 11, 18, 19, 20], 7); // box 0, rows 1-2
    const s = findStep(board)!;
    expect(s.technique).toBe('lockedCandidates');
    expect(s.pattern).toEqual([0, 1, 2]);
    expect(s.eliminations.sort(byCell)).toEqual(
      ROWS[0]!.slice(3).map((cell) => ({ cell, digit: 7 })),
    );
  });

  it('naked pair: two cells sharing the same two candidates', () => {
    const board = openBoard();
    restrict(board, 0, [1, 2]);
    restrict(board, 1, [1, 2]);
    const s = findStep(board)!;
    expect(s.technique).toBe('nakedPair');
    expect(s.unit).toBe(0);
    expect(s.digits).toEqual([1, 2]);
    expect(s.eliminations).toHaveLength(14); // 1 and 2 from the other 7 cells of row 0
  });

  it('hidden pair: two digits confined to the same two cells', () => {
    const board = openBoard();
    // Cells 0 and 4 sit in different boxes, so this is not also a locked-candidates pattern.
    const others = ROWS[0]!.filter((i) => i !== 0 && i !== 4);
    removeDigit(board, others, 4);
    removeDigit(board, others, 5);
    const s = findStep(board)!;
    expect(s.technique).toBe('hiddenPair');
    expect(s.pattern.sort()).toEqual([0, 4]);
    expect(s.eliminations).toHaveLength(14); // the 7 other digits from both cells
  });

  it('x-wing: a digit in two rows confined to the same two columns', () => {
    const board = openBoard();
    for (const r of [1, 4])
      removeDigit(
        board,
        ROWS[r]!.filter((i) => i % 9 !== 2 && i % 9 !== 7),
        5,
      );
    const s = findStep(board)!;
    expect(s.technique).toBe('xWing');
    expect(s.pattern.sort((a, b) => a - b)).toEqual([11, 16, 38, 43]);
    const expected = [...COLS[2]!, ...COLS[7]!]
      .filter((i) => ![11, 16, 38, 43].includes(i))
      .map((cell) => ({ cell, digit: 5 as const }));
    expect(s.eliminations.sort(byCell)).toEqual(expected.sort(byCell));
  });

  it('xy-wing: pivot {1,2} with wings {1,3} and {2,3} removes 3', () => {
    const board = openBoard();
    restrict(board, 0, [1, 2]); // pivot r0c0
    restrict(board, 5, [1, 3]); // wing r0c5
    restrict(board, 36, [2, 3]); // wing r4c0
    const s = findStep(board)!;
    expect(s.technique).toBe('xyWing');
    expect(s.eliminations).toEqual([{ cell: 41, digit: 3 }]); // r4c5 sees both wings
  });

  it('returns null when nothing applies', () => {
    expect(findStep(openBoard())).toBeNull();
  });
});

describe('hints', () => {
  it('gives a placement that matches the solution on a real puzzle', () => {
    const hint = findHint(CLASSIC)!;
    expect(hint.placements.length).toBeGreaterThan(0);
    for (const { cell, digit } of hint.placements) expect(CLASSIC_SOLUTION[cell]).toBe(digit);
  });
});

describe('grader', () => {
  it('rates the classic puzzle as solvable with singles', () => {
    const r = grade(CLASSIC);
    expect(r.solved).toBe(true);
    expect(r.difficulty).toBe('easy');
  });

  it('gives up on puzzles beyond its techniques', () => {
    const r = grade(INKALA);
    expect(r.solved).toBe(false);
    expect(r.difficulty).toBeNull();
  });

  // The core safety property: every deduction, on every tier, agrees with the real solution.
  it.each(DIFFICULTIES)('every %s step is sound', (difficulty) => {
    for (let s = 0; s < 6; s++) {
      const { puzzle, solution } = generatePuzzle({ difficulty, seed: `sound-${difficulty}-${s}` });
      const r = grade(puzzle);
      expect(r.solved).toBe(true);
      for (const st of r.steps) {
        for (const p of st.placements) expect(solution[p.cell]).toBe(p.digit);
        for (const e of st.eliminations) expect(solution[e.cell]).not.toBe(e.digit);
      }
    }
  });
});
