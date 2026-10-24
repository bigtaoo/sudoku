/// <reference lib="webworker" />
import { generatePuzzle, type Difficulty } from '@sudoku/core';

export interface GenerateRequest {
  id: number;
  difficulty: Difficulty;
  seed?: number | string;
}

self.onmessage = (event: MessageEvent<GenerateRequest>) => {
  const { id, difficulty, seed } = event.data;
  try {
    const puzzle = generatePuzzle(seed === undefined ? { difficulty } : { difficulty, seed });
    self.postMessage({ id, puzzle });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
