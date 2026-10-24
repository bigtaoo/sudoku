import { buildApp } from './app';
import { loadConfig } from './config';
import { openDb } from './db';

const config = loadConfig();
const db = openDb(config.dbPath);
const app = await buildApp({ db, config });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    void app.close().finally(() => {
      db.close();
      process.exit(0);
    });
  });
}

await app.listen({ host: config.host, port: config.port });
