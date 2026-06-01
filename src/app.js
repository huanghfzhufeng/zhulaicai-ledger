import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { fail, ApiError } from './lib/http.js';
import { attachUser } from './auth/middleware.js';
import { authRouter } from './routes/auth.js';
import { entriesRouter } from './routes/entries.js';
import { categoriesRouter } from './routes/categories.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());

  // ----- API -----
  app.use('/api', attachUser);
  app.use('/api/auth', authRouter);
  app.use('/api/entries', entriesRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api', (_req, res) => fail(res, 404, '接口不存在'));

  // ----- Static frontend -----
  app.use(express.static(config.publicDir, { extensions: ['html'] }));
  // Anything else: hand back the app shell (its own JS guards auth).
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(config.publicDir, 'index.html'));
  });

  app.use(errorHandler);
  return app;
}

function securityHeaders(_req, res, next) {
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
      "img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; form-action 'self'",
  );
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  if (config.cookieSecure) {
    res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity (4 args).
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let message = '服务器内部错误';

  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = '请求数据格式错误';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    message = '请求数据过大';
  }

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }
  return fail(res, status, message);
}
