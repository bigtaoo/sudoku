// HTTP contract between apps/web and apps/server. Schemas validate requests on the server;
// the inferred types type the client.

import { z } from 'zod';

export const API_VERSION = 'v1';

/** Calendar date in the player's time zone, e.g. 2026-10-24. */
export const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const Nickname = z
  .string()
  .trim()
  .min(1)
  .max(20)
  // No control characters; the name is shown to other players.
  .refine((s) => !/\p{Cc}/u.test(s), 'invalid characters');

export const CreateGuestRequest = z.object({ name: Nickname.optional() });
export type CreateGuestRequest = z.infer<typeof CreateGuestRequest>;

export interface Guest {
  id: string;
  name: string;
}
export interface CreateGuestResponse extends Guest {
  /** Bearer token; only returned once, keep it on the device. */
  token: string;
}

export const UpdateGuestRequest = z.object({ name: Nickname });
export type UpdateGuestRequest = z.infer<typeof UpdateGuestRequest>;

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface DailyResult {
  elapsedMs: number;
  mistakes: number;
  hintsUsed: number;
  scoreMs: number;
  rank: number;
  total: number;
}

export interface DailyPuzzleResponse {
  date: string;
  difficulty: Difficulty;
  /** 81 digits, 0 = empty. */
  puzzle: number[];
  /** The caller's own result, when authenticated and already submitted. */
  result: DailyResult | null;
}

export const SubmitDailyRequest = z.object({
  answer: z.array(z.number().int().min(0).max(9)).length(81),
  elapsedMs: z
    .number()
    .int()
    .min(0)
    .max(24 * 3600_000),
  mistakes: z.number().int().min(0).max(10_000),
  hintsUsed: z.number().int().min(0).max(81),
});
export type SubmitDailyRequest = z.infer<typeof SubmitDailyRequest>;

export type SubmitDailyResponse = DailyResult;

export interface LeaderboardEntry {
  rank: number;
  name: string;
  elapsedMs: number;
  mistakes: number;
  hintsUsed: number;
  scoreMs: number;
  me: boolean;
}

export interface LeaderboardResponse {
  date: string;
  total: number;
  entries: LeaderboardEntry[];
  /** The caller's own entry when it is outside the returned page. */
  me: LeaderboardEntry | null;
}

export const LeaderboardQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export interface ApiError {
  error: string;
  message?: string;
}

/** Penalties folded into the leaderboard score. */
export const SCORE_PENALTY_MS = { hint: 30_000, mistake: 10_000 } as const;

export function scoreMs(r: { elapsedMs: number; mistakes: number; hintsUsed: number }): number {
  return r.elapsedMs + r.hintsUsed * SCORE_PENALTY_MS.hint + r.mistakes * SCORE_PENALTY_MS.mistake;
}
