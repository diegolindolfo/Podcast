import path from 'path';
import { createRequire } from 'module';

interface CacheItem {
  data: any;
  expiresAt: number;
}

// In-memory fallback / serverless cache
const memoryCache = new Map<string, CacheItem>();

let sqliteDb: any = null;
let writesSinceCleanup = 0;

try {
  // Skip SQLite on read-only serverless filesystems (e.g. Vercel)
  if (!process.env.VERCEL) {
    const require = createRequire(import.meta.url);
    const Database = require('better-sqlite3');
    const dbPath = path.resolve(process.cwd(), 'api_cache.db');
    sqliteDb = new Database(dbPath);
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS api_cache (
        key TEXT PRIMARY KEY,
        data TEXT,
        expires_at INTEGER
      )
    `);
    // Purge expired entries on startup
    sqliteDb.prepare('DELETE FROM api_cache WHERE expires_at <= ?').run(Date.now());
  }
} catch {
  // Gracefully fallback to memoryCache in serverless environments
  sqliteDb = null;
}

export function getCache(key: string): any | null {
  const now = Date.now();

  // Try SQLite if available
  if (sqliteDb) {
    try {
      const row = sqliteDb.prepare('SELECT data, expires_at FROM api_cache WHERE key = ?').get(key) as { data: string; expires_at: number } | undefined;
      if (row) {
        if (row.expires_at > now) {
          return JSON.parse(row.data);
        } else {
          sqliteDb.prepare('DELETE FROM api_cache WHERE key = ?').run(key);
        }
      }
      return null;
    } catch (err) {
      console.warn('SQLite getCache fallback:', err);
    }
  }

  // Memory cache fallback
  const item = memoryCache.get(key);
  if (item) {
    if (item.expiresAt > now) {
      return item.data;
    }
    memoryCache.delete(key);
  }

  return null;
}

export function setCache(key: string, data: any, ttlMs: number): void {
  const now = Date.now();
  const expiresAt = now + ttlMs;

  if (sqliteDb) {
    try {
      sqliteDb.prepare('INSERT OR REPLACE INTO api_cache (key, data, expires_at) VALUES (?, ?, ?)').run(key, JSON.stringify(data), expiresAt);
      // Periodically purge expired rows so the SQLite table stays bounded
      if (++writesSinceCleanup >= 50) {
        writesSinceCleanup = 0;
        sqliteDb.prepare('DELETE FROM api_cache WHERE expires_at <= ?').run(now);
      }
      return;
    } catch (err) {
      console.warn('SQLite setCache fallback:', err);
    }
  }

  memoryCache.set(key, { data, expiresAt });

  // Limit memoryCache size to prevent memory leaks in long-running processes
  if (memoryCache.size > 500) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
}
