import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { applySchema } from './schema.js';

/**
 * Thin driver abstraction. Prefers the battle-tested `better-sqlite3`; falls
 * back to Node's built-in `node:sqlite` if the native module is unavailable.
 * Both expose the same `prepare()/exec()/close()` surface for positional (`?`)
 * parameters, so the rest of the app never needs to know which one is active.
 */
async function openDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  try {
    const { default: Database } = await import('better-sqlite3');
    return { db: new Database(dbPath), driverName: 'better-sqlite3' };
  } catch (err) {
    if (err?.code !== 'ERR_MODULE_NOT_FOUND' && err?.code !== 'MODULE_NOT_FOUND') {
      // The module is present but failed to load (e.g. ABI mismatch) — surface it.
      console.warn(`[db] better-sqlite3 unavailable (${err.message}); using node:sqlite`);
    }
    const { DatabaseSync } = await import('node:sqlite');
    return { db: new DatabaseSync(dbPath), driverName: 'node:sqlite' };
  }
}

const { db, driverName } = await openDatabase(config.dbPath);

// Durability + concurrency tuning. WAL lets readers and a writer coexist;
// busy_timeout avoids spurious "database is locked" errors under contention.
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA synchronous = NORMAL;');

applySchema(db);

export { db, driverName };

export function closeDb() {
  try {
    db.close();
  } catch {
    /* already closed */
  }
}
