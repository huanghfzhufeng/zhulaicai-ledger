import { db } from '../db/index.js';

const listStmt = db.prepare('SELECT id, type, name, owner_only FROM categories ORDER BY type, sort, id');
const insertStmt = db.prepare(
  'INSERT OR IGNORE INTO categories (type, name, owner_only, sort) VALUES (?, ?, ?, ?)',
);
const deleteStmt = db.prepare('DELETE FROM categories WHERE type = ? AND name = ?');
const existsStmt = db.prepare('SELECT 1 FROM categories WHERE type = ? AND name = ?');
const staffStmt = db.prepare(
  "SELECT 1 FROM categories WHERE type = 'expense' AND owner_only = 0 AND name = ?",
);
const countStmt = db.prepare('SELECT COUNT(*) AS c FROM categories');

/** Category name lists tailored to a role. */
export function forRole(role) {
  const all = listStmt.all();
  if (role === 'staff') {
    // 员工：只有经营类支出（看不到收入、工资、房租等）
    return { expense: all.filter((c) => c.type === 'expense' && !c.owner_only).map((c) => c.name), income: [] };
  }
  return {
    expense: all.filter((c) => c.type === 'expense').map((c) => c.name),
    income: all.filter((c) => c.type === 'income').map((c) => c.name),
  };
}

export function categoryExists(type, name) {
  return Boolean(existsStmt.get(type, name));
}

/** Staff may only record operational expenses. */
export function isStaffExpenseCategory(name) {
  return Boolean(staffStmt.get(name));
}

export function addCategory({ type, name, ownerOnly = 0 }) {
  insertStmt.run(type, name, ownerOnly ? 1 : 0, 999);
}

/** Remove a category from the pick-list. Recorded entries are unaffected. */
export function removeCategory({ type, name }) {
  return Number(deleteStmt.run(type, name).changes ?? 0) > 0;
}

/** Seed the preset list on first run (when the table is empty). */
export function seedPresetsIfEmpty(presets) {
  if (Number(countStmt.get().c) > 0) return;
  for (const p of presets) insertStmt.run(p.type, p.name, p.owner_only ? 1 : 0, p.sort);
}
