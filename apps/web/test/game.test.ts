import { bit, generatePuzzle } from '@sudoku/core';
import { describe, expect, it } from 'vitest';
import {
  applyHint,
  activeFocus,
  autoNotes,
  erase,
  focusCells,
  inputDigit,
  isWrong,
  moveSelection,
  newGame,
  redo,
  remaining,
  requestHint,
  select,
  tick,
  toggleFocus,
  toggleNoteMode,
  undo,
  type Game,
} from '../src/game/game';

const puzzle = generatePuzzle({ difficulty: 'easy', seed: 42 });
const fresh = () => newGame(puzzle);
// Auto notes and focus mode only exist on hard and expert; the rules do not look at clue counts.
const hard = (): Game => ({ ...fresh(), difficulty: 'hard' });
const firstEmpty = (g: Game) => g.values.findIndex((v) => v === 0);
const wrongDigit = (g: Game, cell: number) => (g.solution[cell]! % 9) + 1;

describe('game rules', () => {
  it('places correct digits and prunes peer notes', () => {
    let g = fresh();
    const cell = firstEmpty(g);
    const d = g.solution[cell]!;
    // Put a note for d in a peer cell first.
    const peer = g.values.findIndex(
      (v, i) => v === 0 && i !== cell && Math.floor(i / 9) === Math.floor(cell / 9),
    );
    g = inputDigit(select(g, peer), d, true);
    expect(g.notes[peer]! & bit(d)).toBeTruthy();
    g = inputDigit(select(g, cell), d);
    expect(g.values[cell]).toBe(d);
    expect(g.notes[peer]! & bit(d)).toBe(0);
    expect(g.mistakes).toBe(0);
  });

  it('counts mistakes and does not edit givens', () => {
    let g = fresh();
    const given = g.puzzle.findIndex((v) => v !== 0);
    expect(inputDigit(select(g, given), 1)).toEqual(select(g, given));
    const cell = firstEmpty(g);
    g = inputDigit(select(g, cell), wrongDigit(g, cell));
    expect(g.mistakes).toBe(1);
    expect(isWrong(g, cell)).toBe(true);
    expect(erase(g).values[cell]).toBe(0);
  });

  it('undoes and redoes', () => {
    let g = select(fresh(), firstEmpty(fresh()));
    const before = g.values;
    g = inputDigit(g, g.solution[g.selected!]!);
    g = undo(g);
    expect(g.values).toEqual(before);
    g = redo(g);
    expect(g.values[g.selected!]).toBe(g.solution[g.selected!]);
    expect(undo(fresh())).toEqual(fresh());
  });

  it('toggles note mode and notes', () => {
    let g = toggleNoteMode(select(fresh(), firstEmpty(fresh())));
    g = inputDigit(g, 5);
    expect(g.notes[g.selected!]).toBe(bit(5));
    g = inputDigit(g, 5);
    expect(g.notes[g.selected!]).toBe(0);
  });

  it('auto notes match candidates', () => {
    const g = autoNotes(hard());
    const cell = firstEmpty(g);
    expect(g.notes[cell]! & bit(g.solution[cell]!)).toBeTruthy();
    expect(g.notes.every((n, i) => (g.values[i] ? n === 0 : n !== 0))).toBe(true);
  });

  it('offers auto notes and focus only on hard and expert', () => {
    const easy = fresh();
    expect(autoNotes(easy)).toBe(easy);
    expect(toggleFocus(easy, 5)).toBe(easy);
  });

  it('focus mode shows where a digit can still go', () => {
    let g = toggleFocus(hard(), 5);
    expect(activeFocus(g)).toBe(5);
    const open = focusCells(g, 5);
    // Every open cell is empty, and the solution's 5s that are still missing are all open.
    for (const i of open) expect(g.values[i]).toBe(0);
    g.solution.forEach((v, i) => {
      if (v === 5 && g.values[i] === 0) expect(open.has(i)).toBe(true);
    });
    expect(open.size).toBeLessThan(g.values.filter((v) => v === 0).length);
    g = toggleFocus(g, 5);
    expect(activeFocus(g)).toBeNull();
  });

  it('wraps selection around the edges', () => {
    expect(moveSelection(select(fresh(), 0), 0, -1).selected).toBe(8);
    expect(moveSelection(select(fresh(), 0), -1, 0).selected).toBe(72);
  });

  it('hints flag mistakes first, then techniques that solve the game', () => {
    let g = fresh();
    const cell = firstEmpty(g);
    g = inputDigit(select(g, cell), wrongDigit(g, cell));
    g = requestHint(g);
    expect(g.hint).toEqual({ kind: 'mistakes', cells: [cell] });
    g = applyHint(g);
    expect(g.values[cell]).toBe(0);

    for (let i = 0; i < 81 && g.status === 'playing'; i++) {
      g = applyHint(requestHint(g));
    }
    expect(g.status).toBe('won');
    expect(g.values).toEqual(g.solution);
  });

  it('runs the clock only while playing', () => {
    const g = tick(fresh(), 1000);
    expect(g.elapsedMs).toBe(1000);
    const won: Game = { ...g, status: 'won' };
    expect(tick(won, 1000).elapsedMs).toBe(1000);
  });

  it('reports remaining counts', () => {
    const g = fresh();
    const d = g.solution[firstEmpty(g)]!;
    expect(remaining(g, d)).toBeGreaterThan(0);
  });
});
