import { Router } from 'express';
import { ok, ApiError } from '../lib/http.js';
import { validateEntryInput } from '../lib/validation.js';
import { isStaffExpenseCategory, categoryExists } from '../models/categories.js';
import { requireAuth } from '../auth/middleware.js';
import { listAll, getById, createEntry, updateEntry, deleteEntry } from '../models/entries.js';

export const entriesRouter = Router();

// Every endpoint here requires login.
entriesRouter.use(requireAuth);

const isStaff = (req) => req.user.role === 'staff';
// 员工只能碰：类型=支出 且 经营类（看不到/碰不到 收入、工资、房租等）
const staffCanTouch = (e) => e.type === 'expense' && isStaffExpenseCategory(e.cat);

entriesRouter.get('/', (req, res) => {
  let entries = listAll();
  if (isStaff(req)) entries = entries.filter(staffCanTouch);
  return ok(res, { entries });
});

entriesRouter.post('/', (req, res) => {
  const { type, date, category, amountCents, oneTime } = validateEntryInput(req.body);
  if (!categoryExists(type, category)) throw new ApiError(400, '类别不存在');
  if (isStaff(req) && !(type === 'expense' && isStaffExpenseCategory(category))) {
    throw new ApiError(403, '员工只能记日常经营支出');
  }
  // 员工不能标一次性投入（那是老板的事）
  const entry = createEntry({ userId: req.user.id, type, date, category, amountCents, oneTime: !isStaff(req) && oneTime });
  return ok(res, { entry }, 201);
});

entriesRouter.patch('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, '无效的记录 ID');

  const existing = getById(id);
  // 员工对自己看不到的记录一律当作"不存在"
  if (!existing || (isStaff(req) && !staffCanTouch(existing))) throw new ApiError(404, '记录不存在');

  const { type, date, category, amountCents, oneTime } = validateEntryInput(req.body);
  if (!categoryExists(type, category)) throw new ApiError(400, '类别不存在');
  if (isStaff(req) && !(type === 'expense' && isStaffExpenseCategory(category))) {
    throw new ApiError(403, '员工只能记日常经营支出');
  }

  const entry = updateEntry(id, { type, date, category, amountCents, oneTime: !isStaff(req) && oneTime });
  return ok(res, { entry });
});

entriesRouter.delete('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, '无效的记录 ID');

  const entry = getById(id);
  // 员工对自己看不到的记录一律当作"不存在"，避免泄露收入/工资条目的存在
  if (!entry || (isStaff(req) && !staffCanTouch(entry))) throw new ApiError(404, '记录不存在');

  deleteEntry(id);
  return ok(res, null);
});
