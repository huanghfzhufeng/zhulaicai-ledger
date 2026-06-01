import { db } from '../db/index.js';

const insertStmt = db.prepare(
  'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
);
const byUsernameStmt = db.prepare(
  'SELECT id, username, password_hash, created_at FROM users WHERE username = ?',
);
const byIdStmt = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?');
const setPasswordStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');

/**
 * Create a user. Throws if the username is taken (relies on the UNIQUE
 * constraint, surfaced as a SQLITE_CONSTRAINT error the caller maps to 409).
 */
export function createUser({ username, passwordHash }) {
  const info = insertStmt.run(username, passwordHash, Date.now());
  return { id: Number(info.lastInsertRowid), username };
}

/** Full row including password_hash — for login only. */
export function findByUsername(username) {
  return byUsernameStmt.get(username) ?? null;
}

/** Safe public row (no password_hash). */
export function findById(id) {
  return byIdStmt.get(id) ?? null;
}

export function setPassword(id, passwordHash) {
  setPasswordStmt.run(passwordHash, id);
}
