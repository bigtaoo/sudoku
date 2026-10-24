import { createHash, randomBytes, randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { isValidSolution } from '@sudoku/core';
import {
  CreateGuestRequest,
  DateString,
  LeaderboardQuery,
  scoreMs,
  SubmitDailyRequest,
  UpdateGuestRequest,
  type CreateGuestResponse,
  type DailyPuzzleResponse,
  type DailyResult,
  type Guest,
  type LeaderboardEntry,
  type LeaderboardResponse,
} from '@sudoku/shared';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import type { z } from 'zod';
import type { Config } from './config';
import { getDailyPuzzle, isPlayableDate, isRealDate } from './daily';
import type { Db } from './db';

export interface AppOptions {
  db: Db;
  config: Pick<Config, 'corsOrigins' | 'rateLimit' | 'logLevel'>;
  /** Injectable clock for tests. */
  now?: () => number;
  logger?: boolean;
}

/** Slack on the server-side timing check: network latency and clock drift. */
const TIMING_SLACK_MS = 15_000;

declare module 'fastify' {
  interface FastifyRequest {
    guest: Guest | null;
  }
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function parse<T extends z.ZodType>(
  schema: T,
  data: unknown,
  reply: FastifyReply,
): z.infer<T> | undefined {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  void reply.code(400).send({ error: 'bad_request', message: result.error.issues[0]?.message });
  return undefined;
}

export async function buildApp({ db, config, now = Date.now, logger = true }: AppOptions) {
  const app = Fastify({
    logger: logger && { level: config.logLevel },
    // Behind Cloudflare and Caddy; the client IP comes from X-Forwarded-For.
    trustProxy: true,
    bodyLimit: 16 * 1024,
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86_400,
  });
  await app.register(rateLimit, { max: config.rateLimit, timeWindow: '1 minute' });

  const q = {
    guestByToken: db.prepare('SELECT id, name FROM guests WHERE token_hash = ?'),
    insertGuest: db.prepare(
      'INSERT INTO guests (id, token_hash, name, created_at) VALUES (?, ?, ?, ?)',
    ),
    renameGuest: db.prepare('UPDATE guests SET name = ? WHERE id = ?'),
    insertStart: db.prepare(
      'INSERT OR IGNORE INTO daily_starts (guest_id, date, started_at) VALUES (?, ?, ?)',
    ),
    getStart: db.prepare('SELECT started_at FROM daily_starts WHERE guest_id = ? AND date = ?'),
    getResult: db.prepare(
      `SELECT elapsed_ms, mistakes, hints_used, score_ms, submitted_at
       FROM daily_results WHERE guest_id = ? AND date = ?`,
    ),
    insertResult: db.prepare(
      `INSERT INTO daily_results
         (guest_id, date, elapsed_ms, mistakes, hints_used, score_ms, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ),
    countAhead: db.prepare(
      `SELECT COUNT(*) AS n FROM daily_results
       WHERE date = ? AND (score_ms < ? OR (score_ms = ? AND submitted_at < ?))`,
    ),
    countDate: db.prepare('SELECT COUNT(*) AS n FROM daily_results WHERE date = ?'),
    topResults: db.prepare(
      `SELECT r.guest_id, g.name, r.elapsed_ms, r.mistakes, r.hints_used, r.score_ms
       FROM daily_results r JOIN guests g ON g.id = r.guest_id
       WHERE r.date = ? ORDER BY r.score_ms, r.submitted_at LIMIT ?`,
    ),
  };

  interface ResultRow {
    elapsed_ms: number;
    mistakes: number;
    hints_used: number;
    score_ms: number;
    submitted_at: number;
  }

  const count = (stmt: typeof q.countDate, ...args: (string | number)[]) =>
    (stmt.get(...args) as { n: number }).n;

  function resultFor(guestId: string, date: string): DailyResult | null {
    const row = q.getResult.get(guestId, date) as ResultRow | undefined;
    if (!row) return null;
    const ahead = count(q.countAhead, date, row.score_ms, row.score_ms, row.submitted_at);
    return {
      elapsedMs: row.elapsed_ms,
      mistakes: row.mistakes,
      hintsUsed: row.hints_used,
      scoreMs: row.score_ms,
      rank: ahead + 1,
      total: count(q.countDate, date),
    };
  }

  app.decorateRequest('guest', null);
  app.addHook('onRequest', async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return;
    const row = q.guestByToken.get(hashToken(header.slice(7).trim())) as Guest | undefined;
    req.guest = row ? { id: row.id, name: row.name } : null;
  });

  const requireGuest = (req: FastifyRequest, reply: FastifyReply): Guest | undefined => {
    if (req.guest) return req.guest;
    void reply.code(401).send({ error: 'unauthorized' });
    return undefined;
  };

  /** Validates the :date param; playable = within a day of UTC today. */
  const dateParam = (
    req: FastifyRequest,
    reply: FastifyReply,
    playable: boolean,
  ): string | undefined => {
    const date = parse(DateString, (req.params as { date: string }).date, reply);
    if (date === undefined) return undefined;
    if (!isRealDate(date) || (playable && !isPlayableDate(date, now()))) {
      void reply.code(404).send({ error: 'no_such_date' });
      return undefined;
    }
    return date;
  };

  app.get('/healthz', async () => ({ ok: true }));

  app.post(
    '/v1/guests',
    { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const body = parse(CreateGuestRequest, req.body ?? {}, reply);
      if (!body) return;
      const id = randomUUID();
      const token = randomBytes(32).toString('base64url');
      const name = body.name ?? `Player ${id.slice(0, 4).toUpperCase()}`;
      q.insertGuest.run(id, hashToken(token), name, now());
      const res: CreateGuestResponse = { id, name, token };
      return reply.code(201).send(res);
    },
  );

  app.get('/v1/me', async (req, reply) => requireGuest(req, reply));

  app.patch('/v1/me', async (req, reply) => {
    const guest = requireGuest(req, reply);
    if (!guest) return;
    const body = parse(UpdateGuestRequest, req.body, reply);
    if (!body) return;
    q.renameGuest.run(body.name, guest.id);
    return { id: guest.id, name: body.name } satisfies Guest;
  });

  app.get('/v1/daily/:date', async (req, reply) => {
    const date = dateParam(req, reply, true);
    if (!date) return;
    const daily = getDailyPuzzle(db, date, now());
    // Opening the puzzle starts the guest's clock for the timing check on submit.
    if (req.guest) q.insertStart.run(req.guest.id, date, now());
    const res: DailyPuzzleResponse = {
      date,
      difficulty: daily.difficulty,
      puzzle: daily.puzzle,
      result: req.guest ? resultFor(req.guest.id, date) : null,
    };
    return res;
  });

  app.post('/v1/daily/:date/result', async (req, reply) => {
    const guest = requireGuest(req, reply);
    if (!guest) return;
    const date = dateParam(req, reply, true);
    if (!date) return;
    const body = parse(SubmitDailyRequest, req.body, reply);
    if (!body) return;

    const start = q.getStart.get(guest.id, date) as { started_at: number } | undefined;
    if (!start) return reply.code(409).send({ error: 'not_started' });
    if (q.getResult.get(guest.id, date))
      return reply.code(409).send({ error: 'already_submitted' });

    const daily = getDailyPuzzle(db, date, now());
    if (!isValidSolution(daily.puzzle, body.answer)) {
      return reply.code(422).send({ error: 'wrong_solution' });
    }
    // The client clock pauses while hidden, so it can only be shorter than wall time.
    if (body.elapsedMs > now() - start.started_at + TIMING_SLACK_MS) {
      return reply.code(422).send({ error: 'implausible_time' });
    }

    q.insertResult.run(
      guest.id,
      date,
      body.elapsedMs,
      body.mistakes,
      body.hintsUsed,
      scoreMs(body),
      now(),
    );
    return reply.code(201).send(resultFor(guest.id, date));
  });

  app.get('/v1/daily/:date/leaderboard', async (req, reply) => {
    const date = dateParam(req, reply, false);
    if (!date) return;
    const query = parse(LeaderboardQuery, req.query, reply);
    if (!query) return;

    interface TopRow {
      guest_id: string;
      name: string;
      elapsed_ms: number;
      mistakes: number;
      hints_used: number;
      score_ms: number;
    }
    const meId = req.guest?.id;
    const entries: LeaderboardEntry[] = (
      q.topResults.all(date, query.limit) as unknown as TopRow[]
    ).map((r, i) => ({
      rank: i + 1,
      name: r.name,
      elapsedMs: r.elapsed_ms,
      mistakes: r.mistakes,
      hintsUsed: r.hints_used,
      scoreMs: r.score_ms,
      me: r.guest_id === meId,
    }));

    let me: LeaderboardEntry | null = null;
    if (req.guest && !entries.some((e) => e.me)) {
      const mine = resultFor(req.guest.id, date);
      if (mine) me = { ...mine, name: req.guest.name, me: true };
    }
    const res: LeaderboardResponse = { date, total: count(q.countDate, date), entries, me };
    return res;
  });

  return app;
}
