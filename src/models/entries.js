import { db } from '../db/index.js';

// 全店共用一本账：账目不按账号隔离。user_id 仅作"由谁录入"的留痕。
// 角色权限（员工只看经营开支）在路由层处理。
const listStmt = db.prepare(
  `SELECT id, type, entry_date, category, amount_cents
     FROM entries
    ORDER BY entry_date ASC, id ASC`,
);
const byIdStmt = db.prepare(
  'SELECT id, type, entry_date, category, amount_cents FROM entries WHERE id = ?',
);
const insertStmt = db.prepare(
  `INSERT INTO entries (user_id, type, entry_date, category, amount_cents, created_at)
   VALUES (?, ?, ?, ?, ?, ?)`,
);
const updateStmt = db.prepare(
  'UPDATE entries SET type = ?, entry_date = ?, category = ?, amount_cents = ? WHERE id = ?',
);
const deleteStmt = db.prepare('DELETE FROM entries WHERE id = ?');

/** Map a DB row to the API/UI shape (amount back to yuan). */
function toApi(row) {
  return {
    id: Number(row.id),
    type: row.type,
    date: row.entry_date,
    cat: row.category,
    amt: Number(row.amount_cents) / 100,
  };
}

export function listAll() {
  return listStmt.all().map(toApi);
}

export function getById(id) {
  const row = byIdStmt.get(id);
  return row ? toApi(row) : null;
}

export function createEntry({ userId, type, date, category, amountCents }) {
  const info = insertStmt.run(userId, type, date, category, amountCents, Date.now());
  return { id: Number(info.lastInsertRowid), type, date, cat: category, amt: amountCents / 100 };
}

/** Update an entry's fields by id. user_id (recorder) is left unchanged. */
export function updateEntry(id, { type, date, category, amountCents }) {
  updateStmt.run(type, date, category, amountCents, id);
  return { id: Number(id), type, date, cat: category, amt: amountCents / 100 };
}

/** Delete one entry by id. Returns true if a row was removed. */
export function deleteEntry(id) {
  const info = deleteStmt.run(id);
  return Number(info.changes ?? 0) > 0;
}
