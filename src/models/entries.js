import { db } from '../db/index.js';

const listStmt = db.prepare(
  `SELECT id, entry_date, category, amount_cents
     FROM entries
    WHERE user_id = ?
    ORDER BY entry_date ASC, id ASC`,
);
const insertStmt = db.prepare(
  `INSERT INTO entries (user_id, entry_date, category, amount_cents, created_at)
   VALUES (?, ?, ?, ?, ?)`,
);
const deleteStmt = db.prepare('DELETE FROM entries WHERE id = ? AND user_id = ?');

/** Map a DB row to the API/UI shape (amount back to yuan). */
function toApi(row) {
  return {
    id: Number(row.id),
    date: row.entry_date,
    cat: row.category,
    amt: Number(row.amount_cents) / 100,
  };
}

export function listByUser(userId) {
  return listStmt.all(userId).map(toApi);
}

export function createEntry({ userId, date, category, amountCents }) {
  const info = insertStmt.run(userId, date, category, amountCents, Date.now());
  return { id: Number(info.lastInsertRowid), date, cat: category, amt: amountCents / 100 };
}

/** Delete one entry scoped to its owner. Returns true if a row was removed. */
export function deleteEntry({ userId, id }) {
  const info = deleteStmt.run(id, userId);
  return Number(info.changes ?? 0) > 0;
}
