import type { Difficulty } from '@sudoku/core';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import * as rules from './game';
import type { Game } from './game';
import { generateInWorker } from './generate';

interface GameStore {
  game: Game | null;
  lastDifficulty: Difficulty;
  generating: boolean;
  error: string | null;
  startNewGame: (difficulty: Difficulty) => Promise<void>;
  /** Applies a pure rule from game.ts to the current game. */
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

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      game: null,
      lastDifficulty: 'medium',
      generating: false,
      error: null,

      startNewGame: async (difficulty) => {
        if (get().generating) return;
        set({ generating: true, error: null, lastDifficulty: difficulty });
        try {
          const puzzle = await generateInWorker(difficulty);
          set({ game: rules.newGame(puzzle), generating: false });
        } catch (error) {
          set({ generating: false, error: String(error) });
        }
      },

      apply: (rule, ...args) => {
        const { game } = get();
        if (!game) return;
        const next = rule(game, ...args);
        if (next !== game) set({ game: next });
      },
    }),
    {
      name: 'sudoku:v1',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      // Transient UI state (open hint) is not worth restoring.
      partialize: (s) => ({
        lastDifficulty: s.lastDifficulty,
        game: s.game && { ...s.game, hint: null },
      }),
    },
  ),
);
