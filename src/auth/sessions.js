import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { config } from '../config.js';

/**
 * Opaque random session tokens. The raw token lives only in the user's cookie;
 * the database stores just its SHA-256 hash, so a DB leak can't resurrect live
 * sessions. Sessions survive server restarts (they're in SQLite, not memory).
 */
const TOKEN_BYTES = 32;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const insertStmt = db.prepare(
  'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
);
const lookupStmt = db.prepare(
  'SELECT user_id, expires_at FROM sessions WHERE token_hash = ?',
);
const deleteStmt = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
const deleteExpiredStmt = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');

/** Create a session for a user. Returns the raw token + expiry (epoch ms). */
export function createSession(userId) {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  const now = Date.now();
  const expiresAt = now + config.sessionTtlMs;
  insertStmt.run(hashToken(token), userId, now, expiresAt);
  return { token, expiresAt };
}

/** Resolve a raw token to a user id, or null if missing/expired. */
export function findUserIdByToken(token) {
  if (!token) return null;
  const row = lookupStmt.get(hashToken(token));
  if (!row) return null;
  if (row.expires_at <= Date.now()) {
    deleteStmt.run(hashToken(token));
    return null;
  }
  return Number(row.user_id);
}

export function destroySession(token) {
  if (token) deleteStmt.run(hashToken(token));
}

/** Housekeeping: remove expired rows. Returns the number deleted. */
export function deleteExpiredSessions() {
  const info = deleteExpiredStmt.run(Date.now());
  return Number(info.changes ?? 0);
}
