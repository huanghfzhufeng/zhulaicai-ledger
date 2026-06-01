import { fail } from './http.js';

/**
 * Tiny in-memory fixed-window rate limiter (no external dependency).
 * Good enough to blunt password brute-force on a single-process server.
 * For multi-process / multi-host deployments, swap for a shared store.
 */
export function rateLimit({ windowMs, max, message = '操作太频繁，请稍后再试' }) {
  const hits = new Map(); // key -> { count, resetAt }

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = clientKey(req);
    const record = hits.get(key);

    if (!record || now >= record.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      pruneOccasionally(hits, now);
      return next();
    }

    record.count += 1;
    if (record.count > max) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return fail(res, 429, message);
    }
    return next();
  };
}

function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

let lastPrune = 0;
function pruneOccasionally(hits, now) {
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [key, record] of hits) {
    if (now >= record.resetAt) hits.delete(key);
  }
}
