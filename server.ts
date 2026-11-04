import express from 'express';
import compression from 'compression';
import path from 'path';
import { createRequire } from 'module';
import { apiRouter, registerCacheAdapter } from './api/index';

// `npm start` passes --prod so production mode does not depend on NODE_ENV being set
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

function initSqliteCache() {
  try {
    const require = createRequire(import.meta.url);
    const Database = require('better-sqlite3');
    const dbPath = path.resolve(process.cwd(), 'api_cache.db');
    const sqliteDb = new Database(dbPath);
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS api_cache (
        key TEXT PRIMARY KEY,
        data TEXT,
        expires_at INTEGER
      )
    `);
    sqliteDb.prepare('DELETE FROM api_cache WHERE expires_at <= ?').run(Date.now());

    let writesSinceCleanup = 0;
    registerCacheAdapter({
      get(key: string) {
        try {
          const now = Date.now();
          const row = sqliteDb.prepare('SELECT data, expires_at FROM api_cache WHERE key = ?').get(key) as { data: string; expires_at: number } | undefined;
          if (!row) return null;
          if (row.expires_at > now) {
            return JSON.parse(row.data);
          }
          sqliteDb.prepare('DELETE FROM api_cache WHERE key = ?').run(key);
          return null;
        } catch {
          return null;
        }
      },
      set(key: string, data: any, ttlMs: number) {
        try {
          const now = Date.now();
          sqliteDb.prepare('INSERT OR REPLACE INTO api_cache (key, data, expires_at) VALUES (?, ?, ?)').run(key, JSON.stringify(data), now + ttlMs);
          if (++writesSinceCleanup >= 50) {
            writesSinceCleanup = 0;
            sqliteDb.prepare('DELETE FROM api_cache WHERE expires_at <= ?').run(now);
          }
        } catch {
          // Ignore SQLite write errors and rely on in-memory cache
        }
      }
    });
  } catch {
    // SQLite is optional; in-memory cache in api/index.ts remains active
  }
}

async function startServer() {
  initSqliteCache();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  if (isProduction) {
    app.set('trust proxy', 1);
  }

  app.use(compression());
  app.use('/api', apiRouter);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
