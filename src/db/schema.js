/**
 * Idempotent schema. Runs on every startup; `IF NOT EXISTS` makes it safe to
 * re-run. Money is stored as integer cents to avoid floating-point drift.
 * Timestamps are epoch milliseconds (INTEGER); entry dates are 'YYYY-MM-DD' text.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
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
  entry_date   TEXT    NOT NULL,
  category     TEXT    NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id, entry_date);
`;

export function applySchema(db) {
  db.exec(SCHEMA_SQL);
}
