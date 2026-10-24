import { generatePuzzle, type Difficulty, type Grid } from '@sudoku/core';
import type { Db } from './db';

/** Monday → Sunday. The week ramps up and peaks on the weekend. */
const WEEKDAY_DIFFICULTY: Difficulty[] = [
  'expert', // Sunday
  'easy',
  'medium',
  'medium',
  'hard',
  'hard',
  'expert',
];

const DAY_MS = 86_400_000;

export function isRealDate(date: string): boolean {
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

export function utcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Players use their local date, which is at most a day away from UTC
 * (UTC-12 … UTC+14), so only yesterday/today/tomorrow in UTC are playable.
 */
export function isPlayableDate(date: string, now: number): boolean {
  return [now - DAY_MS, now, now + DAY_MS].some((t) => utcDate(t) === date);
}

export function dailyDifficulty(date: string): Difficulty {
  return WEEKDAY_DIFFICULTY[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
}

export interface DailyPuzzle {
  date: string;
  difficulty: Difficulty;
  puzzle: Grid;
  solution: Grid;
}

interface DailyRow {
  date: string;
  difficulty: Difficulty;
  puzzle: string;
  solution: string;
}

const toGrid = (s: string): Grid => Array.from(s, Number);

/** Generated once per date (deterministically from the date) and stored. */
export function getDailyPuzzle(db: Db, date: string, now: number): DailyPuzzle {
  const row = db
    .prepare('SELECT date, difficulty, puzzle, solution FROM daily_puzzles WHERE date = ?')
    .get(date) as DailyRow | undefined;
  if (row) return { ...row, puzzle: toGrid(row.puzzle), solution: toGrid(row.solution) };

  const difficulty = dailyDifficulty(date);
  const p = generatePuzzle({ difficulty, seed: `daily:${date}` });
  db.prepare(
    `INSERT OR IGNORE INTO daily_puzzles (date, difficulty, puzzle, solution, seed, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(date, difficulty, p.puzzle.join(''), p.solution.join(''), p.seed, now);
  return { date, difficulty, puzzle: p.puzzle, solution: p.solution };
}
