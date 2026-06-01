import { db } from '../db/index.js';

const insertStmt = db.prepare(
  'INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)',
);
const byUsernameStmt = db.prepare(
  'SELECT id, username, password_hash, role, created_at FROM users WHERE username = ?',
);
const byIdStmt = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?');
const setPasswordStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
const setRoleStmt = db.prepare('UPDATE users SET role = ? WHERE id = ?');

export function createUser({ username, passwordHash, role = 'owner' }) {
  const info = insertStmt.run(username, passwordHash, role, Date.now());
  return { id: Number(info.lastInsertRowid), username, role };
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

export function setRole(id, role) {
  setRoleStmt.run(role, id);
}
