import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

// Isolated in-memory DB + known fixed account. Must be set before importing the app.
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.LEDGER_USERNAME = 'tester';
process.env.LEDGER_PASSWORD = 'secret123';

const { createApp } = await import('../src/app.js');
const { closeDb } = await import('../src/db/index.js');
const { ensureFixedAccount } = await import('../src/auth/seed.js');

await ensureFixedAccount();

const app = createApp();
const server = app.listen(0);
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
  closeDb();
});

const jar = () => ({ cookie: null });

async function call(method, path, { body, j } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (j?.cookie) headers.cookie = j.cookie;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie && j) j.cookie = setCookie.split(';')[0];
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data: payload?.data ?? null, error: payload?.error ?? null };
}

test('categories are public', async () => {
  const res = await call('GET', '/api/categories');
  assert.equal(res.status, 200);
  assert.ok(res.data.expense.includes('煤气'));
  assert.ok(res.data.expense.includes('人工'));
  assert.ok(res.data.income.includes('营业额'));
});

test('me requires auth', async () => {
  const res = await call('GET', '/api/auth/me');
  assert.equal(res.status, 401);
});

test('register endpoint is gone', async () => {
  const res = await call('POST', '/api/auth/register', { body: { username: 'x', password: 'yyyyyy' } });
  assert.equal(res.status, 404);
});

test('login + ledger lifecycle on the shared account', async () => {
  const j = jar();

  const wrong = await call('POST', '/api/auth/login', { body: { username: 'tester', password: 'nope-wrong' }, j });
  assert.equal(wrong.status, 401);

  const login = await call('POST', '/api/auth/login', { body: { username: 'tester', password: 'secret123' }, j });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.username, 'tester');

  const me = await call('GET', '/api/auth/me', { j });
  assert.equal(me.status, 200);

  const bad = await call('POST', '/api/entries', { body: { date: '2026-06-01', cat: '不存在', amt: 5 }, j });
  assert.equal(bad.status, 400);

  const created = await call('POST', '/api/entries', { body: { date: '2026-06-01', cat: '煤气', amt: 128.5 }, j });
  assert.equal(created.status, 201);
  assert.equal(created.data.entry.amt, 128.5);
  assert.equal(created.data.entry.type, 'expense'); // 缺省记为支出
  const entryId = created.data.entry.id;

  const list = await call('GET', '/api/entries', { j });
  assert.equal(list.data.entries.length, 1);

  // 收入
  const inc = await call('POST', '/api/entries', { body: { type: 'income', date: '2026-06-01', cat: '营业额', amt: 500 }, j });
  assert.equal(inc.status, 201);
  assert.equal(inc.data.entry.type, 'income');
  // 收入用了支出类别 -> 400
  const badType = await call('POST', '/api/entries', { body: { type: 'income', date: '2026-06-01', cat: '煤气', amt: 5 }, j });
  assert.equal(badType.status, 400);

  const del = await call('DELETE', `/api/entries/${entryId}`, { j });
  assert.equal(del.status, 200);
  const delAgain = await call('DELETE', `/api/entries/${entryId}`, { j });
  assert.equal(delAgain.status, 404);

  const out = await call('POST', '/api/auth/logout', { j });
  assert.equal(out.status, 200);
  const meAfter = await call('GET', '/api/auth/me', { j });
  assert.equal(meAfter.status, 401);
});
