import { solve, type Difficulty } from '@sudoku/core';
import type { DailyResult } from '@sudoku/shared';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { ApiError, api, localDate } from '../api/client';
import * as rules from './game';
import type { Game } from './game';
import { generateInWorker } from './generate';

export type Mode = 'classic' | 'daily';

export interface DailyState {
  date: string;
  game: Game;
  result: DailyResult | null;
  submit: 'idle' | 'sending' | 'error';
}

interface GameStore {
  mode: Mode;
  classic: Game | null;
  daily: DailyState | null;
  lastDifficulty: Difficulty;
  generating: boolean;
  error: string | null;
  dailyLoading: boolean;
  dailyError: boolean;
  setMode: (mode: Mode) => void;
  startNewGame: (difficulty: Difficulty) => Promise<void>;
  /** Fetches today's puzzle, keeping the saved progress if it is still the same day. */
  loadDaily: () => Promise<void>;
  submitDaily: () => Promise<void>;
  /** Applies a pure rule from game.ts to the game of the current mode. */
  apply: <A extends unknown[]>(rule: (g: Game, ...args: A) => Game, ...args: A) => void;
}

/** localStorage can be missing or throw (private mode, blocked storage); the game must still run. */
const safeStorage: StateStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Saving is best-effort.
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore.
    }
  },
};

export const currentGame = (s: Pick<GameStore, 'mode' | 'classic' | 'daily'>): Game | null =>
  s.mode === 'daily' ? (s.daily?.game ?? null) : s.classic;

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      mode: 'classic',
      classic: null,
      daily: null,
      lastDifficulty: 'medium',
      generating: false,
      error: null,
      dailyLoading: false,
      dailyError: false,

      setMode: (mode) => {
        set({ mode });
        if (mode === 'daily') void get().loadDaily();
        else if (!get().classic) void get().startNewGame(get().lastDifficulty);
      },

      startNewGame: async (difficulty) => {
        if (get().generating) return;
        set({ generating: true, error: null, lastDifficulty: difficulty });
        try {
          const puzzle = await generateInWorker(difficulty);
          set({ classic: rules.newGame(puzzle), generating: false, mode: 'classic' });
        } catch (error) {
          set({ generating: false, error: String(error) });
        }
      },

      loadDaily: async () => {
        if (get().dailyLoading) return;
        const date = localDate();
        set({ dailyLoading: true, dailyError: false });
        try {
          // Fetching also (re)starts the server-side clock, so do it even when resuming.
          const res = await api.daily(date);
          const saved = get().daily;
          if (saved?.date === date) {
            set({ daily: { ...saved, result: res.result ?? saved.result } });
          } else {
            const solution = solve(res.puzzle);
            if (!solution) throw new Error('daily puzzle has no solution');
            const game = rules.newGame({
              puzzle: res.puzzle,
              solution,
              difficulty: res.difficulty,
              score: 0,
              clues: res.puzzle.filter((v) => v !== 0).length,
              seed: 0,
            });
            set({ daily: { date, game, result: res.result, submit: 'idle' } });
          }
          set({ dailyLoading: false });
          // A win that never reached the server (offline, closed tab) is sent now.
          const daily = get().daily;
          if (daily?.game.status === 'won' && !daily.result) void get().submitDaily();
        } catch {
          set({ dailyLoading: false, dailyError: true });
        }
      },

      submitDaily: async () => {
        const daily = get().daily;
        if (!daily || daily.result || daily.submit === 'sending' || daily.game.status !== 'won')
          return;
        const update = (patch: Partial<DailyState>) => {
          const current = get().daily;
          if (current?.date === daily.date) set({ daily: { ...current, ...patch } });
        };
        update({ submit: 'sending' });
        const { game } = daily;
        try {
          const result = await api.submitDaily(daily.date, {
            answer: game.values,
            elapsedMs: Math.round(game.elapsedMs),
            mistakes: game.mistakes,
            hintsUsed: game.hintsUsed,
          });
          update({ result, submit: 'idle' });
        } catch (error) {
          // Submitted earlier (e.g. from another tab): show that result instead.
          if (error instanceof ApiError && error.code === 'already_submitted') {
            const res = await api.daily(daily.date).catch(() => null);
            if (res?.result) return update({ result: res.result, submit: 'idle' });
          }
          update({ submit: 'error' });
        }
      },

      apply: (rule, ...args) => {
        const state = get();
        const game = currentGame(state);
        if (!game) return;
        const next = rule(game, ...args);
        if (next === game) return;
        if (state.mode === 'classic') return set({ classic: next });
        set({ daily: { ...state.daily!, game: next } });
        if (game.status === 'playing' && next.status === 'won') void get().submitDaily();
      },
    }),
    {
      name: 'sudoku:v1',
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      // Transient UI state (open hint, in-flight requests) is not worth restoring.
      partialize: (s) => ({
        mode: s.mode,
        lastDifficulty: s.lastDifficulty,
        classic: s.classic && { ...s.classic, hint: null },
        daily: s.daily && {
          ...s.daily,
          game: { ...s.daily.game, hint: null },
          submit: 'idle' as const,
        },
      }),
      migrate: (persisted, version) => {
        if (version < 2) {
          const v1 = persisted as { game?: Game | null; lastDifficulty?: Difficulty };
          return { mode: 'classic', lastDifficulty: v1.lastDifficulty, classic: v1.game ?? null };
        }
        return persisted;
      },
    },
  ),
);
