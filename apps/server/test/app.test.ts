import { generatePuzzle } from '@sudoku/core';
import type { CreateGuestResponse, DailyPuzzleResponse, LeaderboardResponse } from '@sudoku/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { dailyDifficulty, isPlayableDate, isRealDate } from '../src/daily';
import { openDb, type Db } from '../src/db';

const DATE = '2026-10-24'; // Saturday
const T0 = Date.parse(`${DATE}T08:00:00Z`);
const MIN = 60_000;

let db: Db;
let clock: number;
let app: Awaited<ReturnType<typeof buildApp>>;

beforeEach(async () => {
  db = openDb(':memory:');
  clock = T0;
  app = await buildApp({
    db,
    config: { corsOrigins: ['http://localhost:5173'], rateLimit: 1000, logLevel: 'silent' },
    now: () => clock,
    logger: false,
  });
});
afterEach(async () => {
  await app.close();
  db.close();
});

async function newGuest(name?: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/guests',
    payload: name ? { name } : {},
  });
  expect(res.statusCode).toBe(201);
  return res.json<CreateGuestResponse>();
}
const auth = (token: string) => ({ authorization: `Bearer ${token}` });
const solution = () => generatePuzzle({ difficulty: dailyDifficulty(DATE), seed: `daily:${DATE}` });

async function submit(token: string, body: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: `/v1/daily/${DATE}/result`,
    headers: auth(token),
    payload: { answer: solution().solution, mistakes: 0, hintsUsed: 0, ...body },
  });
}

describe('dates', () => {
  it('validates calendar dates and the playable window', () => {
    expect(isRealDate('2026-02-29')).toBe(false);
    expect(isRealDate('2028-02-29')).toBe(true);
    expect(isPlayableDate('2026-10-25', T0)).toBe(true);
    expect(isPlayableDate('2026-10-26', T0)).toBe(false);
    expect(dailyDifficulty(DATE)).toBe('expert');
  });
});

describe('api', () => {
  it('creates guests and renames them', async () => {
    const g = await newGuest();
    expect(g.name).toMatch(/^Player /);
    const me = await app.inject({ url: '/v1/me', headers: auth(g.token) });
    expect(me.json()).toEqual({ id: g.id, name: g.name });

    const bad = await app.inject({
      method: 'PATCH',
      url: '/v1/me',
      headers: auth(g.token),
      payload: { name: '   ' },
    });
    expect(bad.statusCode).toBe(400);
    const ok = await app.inject({
      method: 'PATCH',
      url: '/v1/me',
      headers: auth(g.token),
      payload: { name: ' 小明 ' },
    });
    expect(ok.json().name).toBe('小明');
    expect((await app.inject({ url: '/v1/me' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/v1/me', headers: auth('nope') })).statusCode).toBe(401);
  });

  it('serves the same daily puzzle to everyone, without the solution', async () => {
    const a = (await app.inject({ url: `/v1/daily/${DATE}` })).json<DailyPuzzleResponse>();
    const b = (await app.inject({ url: `/v1/daily/${DATE}` })).json<DailyPuzzleResponse>();
    expect(a.puzzle).toEqual(b.puzzle);
    expect(a.puzzle).toEqual(solution().puzzle);
    expect(a).not.toHaveProperty('solution');
    expect((await app.inject({ url: '/v1/daily/2026-10-30' })).statusCode).toBe(404);
    expect((await app.inject({ url: '/v1/daily/2026-13-01' })).statusCode).toBe(404);
    expect((await app.inject({ url: '/v1/daily/today' })).statusCode).toBe(400);
  });

  it('checks submissions and ranks them', async () => {
    const alice = await newGuest('Alice');
    const bob = await newGuest('Bob');

    // Must open the puzzle first.
    expect((await submit(alice.token, { elapsedMs: MIN })).json().error).toBe('not_started');
    await app.inject({ url: `/v1/daily/${DATE}`, headers: auth(alice.token) });
    await app.inject({ url: `/v1/daily/${DATE}`, headers: auth(bob.token) });
    clock += 10 * MIN;

    const wrong = solution().solution.slice();
    [wrong[0], wrong[1]] = [wrong[1]!, wrong[0]!];
    expect((await submit(alice.token, { answer: wrong, elapsedMs: MIN })).json().error).toBe(
      'wrong_solution',
    );
    expect((await submit(alice.token, { elapsedMs: 30 * MIN })).json().error).toBe(
      'implausible_time',
    );

    const a = await submit(alice.token, { elapsedMs: 8 * MIN, hintsUsed: 1 });
    expect(a.statusCode).toBe(201);
    expect(a.json()).toMatchObject({ rank: 1, total: 1, scoreMs: 8 * MIN + 30_000 });
    expect((await submit(alice.token, { elapsedMs: MIN })).json().error).toBe('already_submitted');

    const b = await submit(bob.token, { elapsedMs: 7 * MIN, mistakes: 2 });
    expect(b.json()).toMatchObject({ rank: 1, total: 2 });

    const board = (
      await app.inject({
        url: `/v1/daily/${DATE}/leaderboard?limit=1`,
        headers: auth(alice.token),
      })
    ).json<LeaderboardResponse>();
    expect(board.total).toBe(2);
    expect(board.entries).toEqual([
      {
        rank: 1,
        name: 'Bob',
        elapsedMs: 7 * MIN,
        mistakes: 2,
        hintsUsed: 0,
        scoreMs: 7 * MIN + 20_000,
        me: false,
      },
    ]);
    expect(board.me).toMatchObject({ rank: 2, name: 'Alice', me: true });

    const daily = (
      await app.inject({ url: `/v1/daily/${DATE}`, headers: auth(alice.token) })
    ).json<DailyPuzzleResponse>();
    expect(daily.result).toMatchObject({ rank: 2, total: 2 });
  });

  it('sends CORS headers only to allowed origins', async () => {
    const ok = await app.inject({ url: '/healthz', headers: { origin: 'http://localhost:5173' } });
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const no = await app.inject({ url: '/healthz', headers: { origin: 'https://evil.example' } });
    expect(no.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('rate limit', () => {
  async function limitedApp(realIpHeader?: string) {
    const limited = await buildApp({
      db,
      config: { corsOrigins: [], rateLimit: 2, realIpHeader, logLevel: 'silent' },
      logger: false,
    });
    const hit = (ip: string) =>
      limited
        .inject({ method: 'GET', url: '/healthz', headers: { 'cf-connecting-ip': ip } })
        .then((res) => res.statusCode);
    return { limited, hit };
  }

  it('keys on the real-IP header when one is configured', async () => {
    const { limited, hit } = await limitedApp('cf-connecting-ip');
    expect([await hit('1.1.1.1'), await hit('1.1.1.1'), await hit('1.1.1.1')]).toEqual([
      200, 200, 429,
    ]);
    expect(await hit('2.2.2.2')).toBe(200);
    await limited.close();
  });

  it('ignores the header when none is configured', async () => {
    const { limited, hit } = await limitedApp();
    await hit('1.1.1.1');
    await hit('2.2.2.2');
    expect(await hit('3.3.3.3')).toBe(429);
    await limited.close();
  });
});
