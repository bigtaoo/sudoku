// SQLite via the built-in node:sqlite module: no native build step, small image, and plenty
// for one daily puzzle and a few thousand guests on a 2 GB VPS.

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

/** Append-only; the index + 1 is stored in PRAGMA user_version. */
const MIGRATIONS = [
  `
  CREATE TABLE guests (
    id          TEXT PRIMARY KEY,
    token_hash  TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    created_at  INTEGER NOT NULL
  );
  CREATE TABLE daily_puzzles (
    date        TEXT PRIMARY KEY,
    difficulty  TEXT NOT NULL,
    puzzle      TEXT NOT NULL,
    solution    TEXT NOT NULL,
    seed        INTEGER NOT NULL,
    created_at  INTEGER NOT NULL
  );
  CREATE TABLE daily_starts (
    guest_id    TEXT NOT NULL REFERENCES guests(id),
    date        TEXT NOT NULL,
    started_at  INTEGER NOT NULL,
    PRIMARY KEY (guest_id, date)
  );
  CREATE TABLE daily_results (
    guest_id      TEXT NOT NULL REFERENCES guests(id),
    date          TEXT NOT NULL,
    elapsed_ms    INTEGER NOT NULL,
    mistakes      INTEGER NOT NULL,
    hints_used    INTEGER NOT NULL,
    score_ms      INTEGER NOT NULL,
    submitted_at  INTEGER NOT NULL,
    PRIMARY KEY (guest_id, date)
  );
  CREATE INDEX daily_results_rank ON daily_results (date, score_ms, submitted_at);
  `,
];

export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  const { user_version: current } = db.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]!);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
