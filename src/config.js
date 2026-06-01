import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProd = nodeEnv === 'production';

function bool(value, fallback) {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

function int(value, fallback) {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

// Internal tool: one shared, preset account (no public registration).
// Credentials come from the environment; this default exists only for first run.
const DEFAULT_PASSWORD = 'zhulaicai888';

export const config = Object.freeze({
  rootDir,
  publicDir: path.join(rootDir, 'public'),
  nodeEnv,
  isProd,
  port: int(process.env.PORT, 3000),
  host: process.env.HOST ?? '0.0.0.0',
  dbPath: process.env.DB_PATH ?? path.join(rootDir, 'data', 'ledger.db'),
  // Cookies are only sent over HTTPS when secure=true. Default on in production.
  cookieSecure: bool(process.env.COOKIE_SECURE, isProd),
  // Enable when running behind a reverse proxy (nginx/caddy) so secure cookies work.
  trustProxy: bool(process.env.TRUST_PROXY, false),
  sessionTtlMs: int(process.env.SESSION_TTL_DAYS, 30) * 24 * 60 * 60 * 1000,

  // The single shared login for the shop. Change via LEDGER_USERNAME / LEDGER_PASSWORD.
  ledgerUsername: (process.env.LEDGER_USERNAME ?? 'zhulaicai').trim(),
  ledgerPassword: process.env.LEDGER_PASSWORD ?? DEFAULT_PASSWORD,
  usingDefaultPassword: !process.env.LEDGER_PASSWORD,
});
