// Runs puzzle generation off the main thread; hard tiers can take a few hundred ms.

import type { Difficulty, GeneratedPuzzle } from '@sudoku/core';
import type { GenerateRequest } from './generate.worker';

type Reply = { id: number; puzzle: GeneratedPuzzle } | { id: number; error: string };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (p: GeneratedPuzzle) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./generate.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<Reply>) => {
    const reply = event.data;
    const entry = pending.get(reply.id);
    if (!entry) return;
    pending.delete(reply.id);
    if ('puzzle' in reply) entry.resolve(reply.puzzle);
    else entry.reject(new Error(reply.error));
  };
  return worker;
}

export function generateInWorker(
  difficulty: Difficulty,
  seed?: number | string,
): Promise<GeneratedPuzzle> {
  const id = nextId++;
  const request: GenerateRequest =
    seed === undefined ? { id, difficulty } : { id, difficulty, seed };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage(request);
  });
}
