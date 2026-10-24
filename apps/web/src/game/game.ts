// Pure game-state transitions. Every function returns a new Game (or the same one when
// nothing changes), which keeps the Zustand store thin and makes the rules unit-testable.

import {
  bit,
  createBoard,
  findHint,
  PEERS,
  type Difficulty,
  type GeneratedPuzzle,
  type Grid,
  type Step,
} from '@sudoku/core';

export interface Snapshot {
  values: Grid;
  /** Pencil marks per cell, as a candidate bitmask (bit d = digit d). */
  notes: number[];
}

export type ActiveHint =
  { kind: 'mistakes'; cells: number[] } | { kind: 'step'; step: Step } | { kind: 'none' };

export interface Game extends Snapshot {
  puzzle: Grid;
  solution: Grid;
  difficulty: Difficulty;
  seed: number;
  selected: number | null;
  noteMode: boolean;
  history: Snapshot[];
  future: Snapshot[];
  mistakes: number;
  hintsUsed: number;
  elapsedMs: number;
  status: 'playing' | 'won';
  hint: ActiveHint | null;
  /** Focus mode digit; optional because saves from before focus mode lack it. */
  focus?: number | null;
}

const HISTORY_LIMIT = 300;

export function newGame(p: GeneratedPuzzle): Game {
  return {
    puzzle: p.puzzle,
    solution: p.solution,
    difficulty: p.difficulty,
    seed: p.seed,
    values: p.puzzle.slice(),
    notes: new Array<number>(81).fill(0),
    selected: null,
    noteMode: false,
    history: [],
    future: [],
    mistakes: 0,
    hintsUsed: 0,
    elapsedMs: 0,
    status: 'playing',
    hint: null,
    focus: null,
  };
}

/** Auto notes and focus mode are offered on hard and expert only: there they save busywork,
 * while on easy and medium writing candidates and spotting singles is the whole puzzle. */
export function hasAssists(g: Game): boolean {
  return g.difficulty === 'hard' || g.difficulty === 'expert';
}

export function isGiven(g: Game, cell: number): boolean {
  return g.puzzle[cell] !== 0;
}

export function isWrong(g: Game, cell: number): boolean {
  const v = g.values[cell]!;
  return v !== 0 && v !== g.solution[cell];
}

/** How many more times digit d still has to be placed correctly. */
export function remaining(g: Game, d: number): number {
  let placed = 0;
  for (let i = 0; i < 81; i++) if (g.values[i] === d && g.solution[i] === d) placed++;
  return 9 - placed;
}

function snapshot(g: Game): Snapshot {
  return { values: g.values, notes: g.notes };
}

/** Records the current position for undo, then applies the new one. */
function commit(g: Game, next: Snapshot, extra: Partial<Game> = {}): Game {
  const history = [...g.history, snapshot(g)].slice(-HISTORY_LIMIT);
  const won = next.values.every((v, i) => v === g.solution[i]);
  return {
    ...g,
    ...next,
    history,
    future: [],
    hint: null,
    ...extra,
    status: won ? 'won' : g.status,
  };
}

/** Places a digit and clears it from the pencil marks of its peers. */
function place(values: Grid, notes: number[], cell: number, d: number): void {
  values[cell] = d;
  notes[cell] = 0;
  for (const p of PEERS[cell]!) notes[p]! &= ~bit(d);
}

function canEdit(g: Game): g is Game & { selected: number } {
  return g.status === 'playing' && g.selected !== null && !isGiven(g, g.selected);
}

export function inputDigit(g: Game, d: number, asNote = g.noteMode): Game {
  if (!canEdit(g)) return g;
  const cell = g.selected;
  if (asNote) {
    if (g.values[cell]) return g;
    const notes = g.notes.slice();
    notes[cell]! ^= bit(d);
    return commit(g, { values: g.values, notes });
  }
  if (g.values[cell] === d) return g;
  const values = g.values.slice();
  const notes = g.notes.slice();
  const correct = d === g.solution[cell];
  // Only correct digits prune peer notes, so a mistake does not wipe out the player's marks.
  if (correct) place(values, notes, cell, d);
  else {
    values[cell] = d;
    notes[cell] = 0;
  }
  return commit(g, { values, notes }, { mistakes: g.mistakes + (correct ? 0 : 1) });
}

export function erase(g: Game): Game {
  if (!canEdit(g)) return g;
  const cell = g.selected;
  if (!g.values[cell] && !g.notes[cell]) return g;
  const values = g.values.slice();
  const notes = g.notes.slice();
  values[cell] = 0;
  notes[cell] = 0;
  return commit(g, { values, notes });
}

export function undo(g: Game): Game {
  const prev = g.history.at(-1);
  if (!prev || g.status !== 'playing') return g;
  return {
    ...g,
    ...prev,
    history: g.history.slice(0, -1),
    future: [snapshot(g), ...g.future],
    hint: null,
  };
}

export function redo(g: Game): Game {
  const next = g.future[0];
  if (!next || g.status !== 'playing') return g;
  return {
    ...g,
    ...next,
    history: [...g.history, snapshot(g)],
    future: g.future.slice(1),
    hint: null,
  };
}

export function select(g: Game, cell: number | null): Game {
  return g.selected === cell ? g : { ...g, selected: cell };
}

export function moveSelection(g: Game, dRow: number, dCol: number): Game {
  const from = g.selected ?? 40;
  const row = (Math.floor(from / 9) + dRow + 9) % 9;
  const col = ((from % 9) + dCol + 9) % 9;
  return select(g, row * 9 + col);
}

export function toggleNoteMode(g: Game): Game {
  return { ...g, noteMode: !g.noteMode };
}

/** Fills every empty cell's pencil marks with its current candidates. */
export function autoNotes(g: Game): Game {
  if (g.status !== 'playing' || !hasAssists(g)) return g;
  const { cands } = createBoard(correctValues(g));
  const notes = g.notes.map((_, i) => (g.values[i] ? 0 : cands[i]!));
  if (notes.every((n, i) => n === g.notes[i])) return g;
  return commit(g, { values: g.values, notes });
}

/** Long-press on a number toggles focus mode for it (see focusCells). */
export function toggleFocus(g: Game, d: number): Game {
  if (g.status !== 'playing' || !hasAssists(g)) return g;
  return { ...g, focus: g.focus === d ? null : d };
}

/** The focused digit, or null once it is fully placed (its key is then disabled and could not
 * switch focus off). */
export function activeFocus(g: Game): number | null {
  const d = g.focus;
  return d && g.status === 'playing' && remaining(g, d) > 0 ? d : null;
}

/** Empty cells that see no d on the board: the places d can still go. Uses the board as the
 * player has it, wrong entries included, like a solver working on paper would. */
export function focusCells(g: Game, d: number): Set<number> {
  const open = new Set<number>();
  for (let i = 0; i < 81; i++) {
    if (!g.values[i] && !PEERS[i]!.some((p) => g.values[p] === d)) open.add(i);
  }
  return open;
}

/** Values with wrong entries removed, so candidates are computed from facts only. */
function correctValues(g: Game): Grid {
  return g.values.map((v, i) => (v === g.solution[i] ? v : 0));
}

export function requestHint(g: Game): Game {
  if (g.status !== 'playing') return g;
  const wrong = g.values.flatMap((_, i) => (isWrong(g, i) ? [i] : []));
  if (wrong.length) return { ...g, hint: { kind: 'mistakes', cells: wrong } };
  const step = findHint(g.values);
  if (!step) return { ...g, hint: { kind: 'none' } };
  const focus = step.placements[0]?.cell ?? step.eliminations[0]?.cell ?? g.selected;
  return {
    ...g,
    hint: { kind: 'step', step },
    hintsUsed: g.hintsUsed + 1,
    selected: focus ?? null,
  };
}

export function dismissHint(g: Game): Game {
  return g.hint ? { ...g, hint: null } : g;
}

export function applyHint(g: Game): Game {
  const hint = g.hint;
  if (!hint || hint.kind === 'none' || g.status !== 'playing') return dismissHint(g);
  const values = g.values.slice();
  const notes = g.notes.slice();

  if (hint.kind === 'mistakes') {
    for (const cell of hint.cells) values[cell] = 0;
    return commit(g, { values, notes });
  }

  const { step } = hint;
  for (const { cell, digit } of step.placements) place(values, notes, cell, digit);
  if (step.eliminations.length) {
    // Pencil marks may be empty; seed them from the true candidates so the removal is visible.
    const { cands } = createBoard(values);
    for (const { cell, digit } of step.eliminations) {
      if (!notes[cell]) notes[cell] = cands[cell]!;
      notes[cell]! &= ~bit(digit);
    }
  }
  return commit(g, { values, notes });
}

export function tick(g: Game, ms: number): Game {
  return g.status === 'playing' ? { ...g, elapsedMs: g.elapsedMs + ms } : g;
}
