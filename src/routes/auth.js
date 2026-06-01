import { Router } from 'express';
import { config } from '../config.js';
import { ok, ApiError } from '../lib/http.js';
import { requireLoginCredentials } from '../lib/validation.js';
import { rateLimit } from '../lib/rate-limit.js';
import { verifyPassword } from '../auth/password.js';
import { createSession, destroySession } from '../auth/sessions.js';
import { COOKIE_NAME, requireAuth } from '../auth/middleware.js';
import { findByUsername } from '../models/users.js';

export const authRouter = Router();

// Throttle login to slow down brute-force / abuse.
const loginLimiter = rateLimit({ windowMs: 60_000, max: 20 });

const publicUser = (user) => ({ id: user.id, username: user.username });

function setSessionCookie(res, token, expiresAt) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
    expires: new Date(expiresAt),
  });
}

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = requireLoginCredentials(req.body);
  const user = findByUsername(username);

  const valid = user && (await verifyPassword(password, user.password_hash));
  if (!valid) throw new ApiError(401, '用户名或密码错误');

  const { token, expiresAt } = createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  return ok(res, { user: publicUser(user) });
});

authRouter.post('/logout', (req, res) => {
  destroySession(req.cookies?.[COOKIE_NAME]);
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
  });
  return ok(res, null);
});

authRouter.get('/me', requireAuth, (req, res) => ok(res, { user: publicUser(req.user) }));
