/**
 * Idempotent schema. Runs on every startup; `IF NOT EXISTS` makes it safe to
 * re-run. Money is stored as integer cents to avoid floating-point drift.
 * Timestamps are epoch milliseconds (INTEGER); entry dates are 'YYYY-MM-DD' text.
 * `type` is 'expense' | 'income' (defaults to 'expense' for legacy rows).
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'owner',
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS entries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  type         TEXT    NOT NULL DEFAULT 'expense',
  entry_date   TEXT    NOT NULL,
  category     TEXT    NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id, entry_date);

-- 可编辑的"记账类别清单"。entries 存的是类别名字符串，不依赖这张表，
-- 所以删类别只影响"可选清单"，不影响已记的账。owner_only=1 表示仅老板可见(工资/房租)。
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  owner_only INTEGER NOT NULL DEFAULT 0,
  sort       INTEGER NOT NULL DEFAULT 0,
  UNIQUE(type, name)
);
`;

export function applySchema(db) {
  db.exec(SCHEMA_SQL);
  migrate(db);
}

/** Add columns introduced after the initial release (safe on existing data). */
function migrate(db) {
  const entryCols = db.prepare("PRAGMA table_info('entries')").all().map((c) => c.name);
  if (!entryCols.includes('type')) {
    db.exec("ALTER TABLE entries ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'");
  }
  const userCols = db.prepare("PRAGMA table_info('users')").all().map((c) => c.name);
  if (!userCols.includes('role')) {
    // Existing single account becomes the owner.
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'owner'");
  }
}
