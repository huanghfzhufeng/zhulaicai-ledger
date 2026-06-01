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

// Internal tool: preset accounts (no public registration). Two roles:
// owner (老板, sees everything incl. profit/wages) and staff (员工, records
// operational expenses only). Credentials come from the environment; these
// defaults exist only for first run.
const DEFAULT_PASSWORD = 'zhulaicai888';
const DEFAULT_STAFF_PASSWORD = 'yuangong888';

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

  // 老板账号（看得到全部 + 利润/工资）。改 LEDGER_USERNAME / LEDGER_PASSWORD。
  ledgerUsername: (process.env.LEDGER_USERNAME ?? 'zhulaicai').trim(),
  ledgerPassword: process.env.LEDGER_PASSWORD ?? DEFAULT_PASSWORD,
  usingDefaultPassword: !process.env.LEDGER_PASSWORD,

  // 员工账号（只记经营开支，看不到收入/利润/工资）。改 STAFF_USERNAME / STAFF_PASSWORD。
  staffUsername: (process.env.STAFF_USERNAME ?? 'yuangong').trim(),
  staffPassword: process.env.STAFF_PASSWORD ?? DEFAULT_STAFF_PASSWORD,
  usingDefaultStaffPassword: !process.env.STAFF_PASSWORD,
});
