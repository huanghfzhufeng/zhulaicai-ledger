import { fail } from '../lib/http.js';
import { findUserIdByToken } from './sessions.js';
import { findById } from '../models/users.js';

export const COOKIE_NAME = 'sid';

/**
 * Resolve the session cookie to `req.user` on every request (or null).
 * Never blocks — route guards decide whether auth is required.
 */
export function attachUser(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE_NAME];
  const userId = findUserIdByToken(token);
  if (userId !== null) {
    req.user = findById(userId);
  }
  next();
}

/** Reject unauthenticated requests with 401. */
export function requireAuth(req, res, next) {
  if (!req.user) return fail(res, 401, '未登录或登录已过期');
  next();
}

/** Owner-only actions (e.g. managing categories). Assumes requireAuth ran first. */
export function requireOwner(req, res, next) {
  if (req.user?.role !== 'owner') return fail(res, 403, '仅老板可操作');
  next();
}
