import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

// Isolated in-memory DB + known accounts. Must be set before importing the app.
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.LEDGER_USERNAME = 'boss';
process.env.LEDGER_PASSWORD = 'boss123';
process.env.STAFF_USERNAME = 'clerk';
process.env.STAFF_PASSWORD = 'clerk123';

const { createApp } = await import('../src/app.js');
const { closeDb } = await import('../src/db/index.js');
const { ensureAccounts } = await import('../src/auth/seed.js');
const { seedPresetsIfEmpty } = await import('../src/models/categories.js');
const { PRESET_CATEGORIES } = await import('../src/lib/categories.js');

await ensureAccounts();
seedPresetsIfEmpty(PRESET_CATEGORIES);

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

async function login(username, password) {
  const j = jar();
  const res = await call('POST', '/api/auth/login', { body: { username, password }, j });
  assert.equal(res.status, 200, `login ${username}`);
  return { j, user: res.data.user };
}

test('auth + categories require login', async () => {
  assert.equal((await call('GET', '/api/auth/me')).status, 401);
  assert.equal((await call('GET', '/api/categories')).status, 401);
});

test('register endpoint is gone', async () => {
  const res = await call('POST', '/api/auth/register', { body: { username: 'x', password: 'yyyyyy' } });
  assert.equal(res.status, 404);
});

test('owner sees everything and records income/wages', async () => {
  const { j, user } = await login('boss', 'boss123');
  assert.equal(user.role, 'owner');

  const cats = await call('GET', '/api/categories', { j });
  assert.ok(cats.data.expense.includes('人工'));
  assert.ok(cats.data.income.includes('营业额'));

  assert.equal((await call('POST', '/api/entries', { body: { type: 'income', date: '2026-06-01', cat: '营业额', amt: 3500 }, j })).status, 201);
  assert.equal((await call('POST', '/api/entries', { body: { type: 'expense', date: '2026-06-01', cat: '人工', amt: 800 }, j })).status, 201);
  assert.equal((await call('POST', '/api/entries', { body: { type: 'expense', date: '2026-06-01', cat: '煤气', amt: 128 }, j })).status, 201);

  const list = await call('GET', '/api/entries', { j });
  assert.equal(list.data.entries.length, 3); // 收入 + 工资 + 煤气
});

test('staff is restricted to operational expenses (no income/profit/wages)', async () => {
  const { j, user } = await login('clerk', 'clerk123');
  assert.equal(user.role, 'staff');

  // 类别：只有经营类，没有人工/房租，没有收入
  const cats = await call('GET', '/api/categories', { j });
  assert.ok(cats.data.expense.includes('煤气'));
  assert.ok(!cats.data.expense.includes('人工'));
  assert.deepEqual(cats.data.income, []);

  // 看账：拿不到老板的收入/工资，只看到经营开支（上一个测试里 owner 记的煤气）
  const list = await call('GET', '/api/entries', { j });
  assert.ok(list.data.entries.every((e) => e.type === 'expense' && e.cat !== '人工'));
  assert.ok(list.data.entries.every((e) => e.cat !== '营业额'));

  // 记账：收入 403、工资 403、经营支出 201
  assert.equal((await call('POST', '/api/entries', { body: { type: 'income', date: '2026-06-01', cat: '营业额', amt: 99 }, j })).status, 403);
  assert.equal((await call('POST', '/api/entries', { body: { type: 'expense', date: '2026-06-01', cat: '人工', amt: 99 }, j })).status, 403);
  assert.equal((await call('POST', '/api/entries', { body: { type: 'expense', date: '2026-06-01', cat: '配料', amt: 30 }, j })).status, 201);

  // 删除老板的收入条目（id 应为 1）-> 对员工是 404（看不到也碰不到）
  assert.equal((await call('DELETE', '/api/entries/1', { j })).status, 404);
});

test('owner can add/remove categories; staff cannot; history is preserved', async () => {
  const owner = await login('boss', 'boss123');
  const staff = await login('clerk', 'clerk123');

  // 老板加自定义支出「水果」
  const added = await call('POST', '/api/categories', { body: { type: 'expense', name: '水果' }, j: owner.j });
  assert.equal(added.status, 201);
  assert.ok(added.data.expense.includes('水果'));
  // 重复 -> 409
  assert.equal((await call('POST', '/api/categories', { body: { type: 'expense', name: '水果' }, j: owner.j })).status, 409);

  // 员工能看到并能用「水果」（经营类），但不能管理类别
  const staffCats = await call('GET', '/api/categories', { j: staff.j });
  assert.ok(staffCats.data.expense.includes('水果'));
  assert.equal((await call('POST', '/api/entries', { body: { type: 'expense', date: '2026-06-02', cat: '水果', amt: 20 }, j: staff.j })).status, 201);
  assert.equal((await call('POST', '/api/categories', { body: { type: 'expense', name: '偷加' }, j: staff.j })).status, 403);
  assert.equal((await call('DELETE', '/api/categories', { body: { type: 'expense', name: '水果' }, j: staff.j })).status, 403);

  // 老板删「水果」：从清单移除，但已记的账不受影响
  assert.equal((await call('DELETE', '/api/categories', { body: { type: 'expense', name: '水果' }, j: owner.j })).status, 200);
  assert.ok(!(await call('GET', '/api/categories', { j: owner.j })).data.expense.includes('水果'));
  assert.equal((await call('POST', '/api/entries', { body: { type: 'expense', date: '2026-06-02', cat: '水果', amt: 1 }, j: owner.j })).status, 400);
  assert.ok((await call('GET', '/api/entries', { j: owner.j })).data.entries.some((e) => e.cat === '水果'));
});

test('entries can be edited, with role limits', async () => {
  const owner = await login('boss', 'boss123');
  const staff = await login('clerk', 'clerk123');

  // 老板：建一笔支出 → 改金额+类别
  const c = await call('POST', '/api/entries', { body: { type: 'expense', date: '2026-06-03', cat: '煤气', amt: 50 }, j: owner.j });
  const id = c.data.entry.id;
  const u = await call('PATCH', `/api/entries/${id}`, { body: { type: 'expense', date: '2026-06-03', cat: '配料', amt: 66 }, j: owner.j });
  assert.equal(u.status, 200);
  assert.equal(u.data.entry.cat, '配料');
  assert.equal(u.data.entry.amt, 66);
  // 改成不存在的类别 → 400
  assert.equal((await call('PATCH', `/api/entries/${id}`, { body: { type: 'expense', date: '2026-06-03', cat: '不存在', amt: 10 }, j: owner.j })).status, 400);

  // 老板建一笔收入，员工去改它 → 404（看不到也碰不到）
  const inc = await call('POST', '/api/entries', { body: { type: 'income', date: '2026-06-03', cat: '营业额', amt: 999 }, j: owner.j });
  assert.equal((await call('PATCH', `/api/entries/${inc.data.entry.id}`, { body: { type: 'expense', date: '2026-06-03', cat: '煤气', amt: 10 }, j: staff.j })).status, 404);

  // 员工：建经营支出 → 自己改成功；改成收入 → 403
  const sc = await call('POST', '/api/entries', { body: { type: 'expense', date: '2026-06-03', cat: '煤气', amt: 20 }, j: staff.j });
  assert.equal((await call('PATCH', `/api/entries/${sc.data.entry.id}`, { body: { type: 'expense', date: '2026-06-03', cat: '配料', amt: 25 }, j: staff.j })).status, 200);
  assert.equal((await call('PATCH', `/api/entries/${sc.data.entry.id}`, { body: { type: 'income', date: '2026-06-03', cat: '营业额', amt: 5 }, j: staff.j })).status, 403);
});

test('one-time expense flag: owner-only, expense-only, editable', async () => {
  const owner = await login('boss', 'boss123');
  const staff = await login('clerk', 'clerk123');

  // 老板：标「一次性」的装修支出 → oneTime=true
  const one = await call('POST', '/api/entries', { body: { type: 'expense', date: '2026-06-04', cat: '配料', amt: 5000, oneTime: true }, j: owner.j });
  assert.equal(one.status, 201);
  assert.equal(one.data.entry.oneTime, true);

  // 普通支出默认 oneTime=false（老数据/不传也一样）
  const normal = await call('POST', '/api/entries', { body: { type: 'expense', date: '2026-06-04', cat: '煤气', amt: 100 }, j: owner.j });
  assert.equal(normal.data.entry.oneTime, false);

  // 收入即使传 oneTime:true 也被忽略（一次性只对支出有意义）
  const inc = await call('POST', '/api/entries', { body: { type: 'income', date: '2026-06-04', cat: '营业额', amt: 200, oneTime: true }, j: owner.j });
  assert.equal(inc.data.entry.oneTime, false);

  // 编辑：把一次性取消 / 再打开都生效
  const off = await call('PATCH', `/api/entries/${one.data.entry.id}`, { body: { type: 'expense', date: '2026-06-04', cat: '配料', amt: 5000, oneTime: false }, j: owner.j });
  assert.equal(off.data.entry.oneTime, false);
  const on = await call('PATCH', `/api/entries/${one.data.entry.id}`, { body: { type: 'expense', date: '2026-06-04', cat: '配料', amt: 5000, oneTime: true }, j: owner.j });
  assert.equal(on.data.entry.oneTime, true);

  // 员工无权标一次性：即便传 oneTime:true，也被强制为 false
  const se = await call('POST', '/api/entries', { body: { type: 'expense', date: '2026-06-04', cat: '煤气', amt: 30, oneTime: true }, j: staff.j });
  assert.equal(se.status, 201);
  assert.equal(se.data.entry.oneTime, false);
  // 员工编辑也不能打开一次性
  const su = await call('PATCH', `/api/entries/${se.data.entry.id}`, { body: { type: 'expense', date: '2026-06-04', cat: '配料', amt: 30, oneTime: true }, j: staff.j });
  assert.equal(su.data.entry.oneTime, false);
});
