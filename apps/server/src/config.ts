export interface Config {
  host: string;
  port: number;
  dbPath: string;
  /** Browser origins allowed to call the API. */
  corsOrigins: string[];
  /** Requests per minute per IP across the API. */
  rateLimit: number;
  /**
   * Request header carrying the real client IP, set by a trusted proxy in front of the API
   * (cf-connecting-ip behind a Cloudflare Tunnel). Unset: use X-Forwarded-For / the socket.
   */
  realIpHeader?: string | undefined;
  logLevel: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    host: env.HOST ?? '0.0.0.0',
    port: Number(env.PORT ?? 8787),
    dbPath: env.DB_PATH ?? './data/sudoku.sqlite',
    corsOrigins: (env.CORS_ORIGINS ?? 'https://s.gamestao.com,http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    rateLimit: Number(env.RATE_LIMIT ?? 120),
    realIpHeader: env.REAL_IP_HEADER?.trim().toLowerCase() || undefined,
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}
