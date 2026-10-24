// Thin typed client for apps/server. The guest identity (id, name, token) lives in
// localStorage; it is created lazily on the first call that needs it.

import type {
  CreateGuestResponse,
  DailyPuzzleResponse,
  Guest,
  LeaderboardResponse,
  SubmitDailyRequest,
  SubmitDailyResponse,
} from '@sudoku/shared';

const BASE_URL: string =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:8787' : 'https://sudoku-api.gamestao.com');

const GUEST_KEY = 'sudoku:guest';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
  }
}

function readGuest(): CreateGuestResponse | null {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    return raw ? (JSON.parse(raw) as CreateGuestResponse) : null;
  } catch {
    return null;
  }
}

function writeGuest(guest: CreateGuestResponse | null): void {
  try {
    if (guest) localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
    else localStorage.removeItem(GUEST_KEY);
  } catch {
    // Without storage the guest only lives for this page load.
  }
}

let memoryGuest = readGuest();
let creating: Promise<CreateGuestResponse> | null = null;

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? 'http_error');
  }
  return (await res.json()) as T;
}

export function currentGuest(): Guest | null {
  return memoryGuest && { id: memoryGuest.id, name: memoryGuest.name };
}

async function ensureGuest(): Promise<CreateGuestResponse> {
  if (memoryGuest) return memoryGuest;
  creating ??= request<CreateGuestResponse>('/v1/guests', { method: 'POST', body: '{}' })
    .then((guest) => {
      memoryGuest = guest;
      writeGuest(guest);
      return guest;
    })
    .finally(() => {
      creating = null;
    });
  return creating;
}

/** Calls with the guest token; a token the server no longer knows is replaced once. */
async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  const guest = await ensureGuest();
  try {
    return await request<T>(path, init, guest.token);
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error;
    memoryGuest = null;
    writeGuest(null);
    return request<T>(path, init, (await ensureGuest()).token);
  }
}

export const api = {
  daily: (date: string) => authed<DailyPuzzleResponse>(`/v1/daily/${date}`),

  submitDaily: (date: string, body: SubmitDailyRequest) =>
    authed<SubmitDailyResponse>(`/v1/daily/${date}/result`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  leaderboard: (date: string, limit = 50) =>
    authed<LeaderboardResponse>(`/v1/daily/${date}/leaderboard?limit=${limit}`),

  rename: async (name: string) => {
    const guest = await authed<Guest>('/v1/me', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    if (memoryGuest) {
      memoryGuest = { ...memoryGuest, name: guest.name };
      writeGuest(memoryGuest);
    }
    return guest;
  },
};

/** The player's local calendar date (the daily puzzle follows local midnight). */
export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
