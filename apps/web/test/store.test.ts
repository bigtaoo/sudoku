import { generatePuzzle } from '@sudoku/core';
import type { DailyResult } from '@sudoku/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/api/client';
import { inputDigit, select } from '../src/game/game';
import { currentGame, useGameStore } from '../src/game/store';

vi.mock('../src/api/client', () => ({
  api: { daily: vi.fn(), submitDaily: vi.fn() },
  localDate: () => '2026-10-24',
  ApiError: class extends Error {},
}));

const p = generatePuzzle({ difficulty: 'easy', seed: 'store-test' });
const RESULT: DailyResult = {
  elapsedMs: 1000,
  mistakes: 0,
  hintsUsed: 0,
  scoreMs: 1000,
  rank: 1,
  total: 1,
};

beforeEach(() => {
  vi.mocked(api.daily).mockResolvedValue({
    date: '2026-10-24',
    difficulty: 'easy',
    puzzle: p.puzzle,
    result: null,
  });
  vi.mocked(api.submitDaily).mockResolvedValue(RESULT);
  useGameStore.setState({ mode: 'classic', classic: null, daily: null, dailyLoading: false });
});

describe('daily mode', () => {
  it('loads the puzzle, solves it locally and submits the win once', async () => {
    useGameStore.getState().setMode('daily');
    await vi.waitFor(() => expect(useGameStore.getState().daily).not.toBeNull());
    const { apply } = useGameStore.getState();
    expect(currentGame(useGameStore.getState())!.solution).toEqual(p.solution);

    for (let cell = 0; cell < 81; cell++) {
      if (p.puzzle[cell]) continue;
      apply(select, cell);
      apply(inputDigit, p.solution[cell]!, false);
    }
    await vi.waitFor(() => expect(useGameStore.getState().daily!.result).toEqual(RESULT));
    expect(api.submitDaily).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitDaily).mock.calls[0]![1]).toMatchObject({
      answer: p.solution,
      mistakes: 0,
      hintsUsed: 0,
    });
    // Classic progress is untouched by daily moves.
    expect(useGameStore.getState().classic).toBeNull();
  });

  it('keeps saved progress for the same day', async () => {
    useGameStore.getState().setMode('daily');
    await vi.waitFor(() => expect(useGameStore.getState().daily).not.toBeNull());
    const cell = p.puzzle.indexOf(0);
    useGameStore.getState().apply(select, cell);
    useGameStore.getState().apply(inputDigit, p.solution[cell]!, false);

    await useGameStore.getState().loadDaily();
    expect(useGameStore.getState().daily!.game.values[cell]).toBe(p.solution[cell]);
  });
});
