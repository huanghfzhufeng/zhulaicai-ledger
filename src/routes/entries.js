import { Router } from 'express';
import { ok, ApiError } from '../lib/http.js';
import { validateEntryInput } from '../lib/validation.js';
import { requireAuth } from '../auth/middleware.js';
import { listByUser, createEntry, deleteEntry } from '../models/entries.js';

export const entriesRouter = Router();

// Every endpoint here is owner-scoped.
entriesRouter.use(requireAuth);

entriesRouter.get('/', (req, res) => {
  return ok(res, { entries: listByUser(req.user.id) });
});

entriesRouter.post('/', (req, res) => {
  const { type, date, category, amountCents } = validateEntryInput(req.body);
  const entry = createEntry({ userId: req.user.id, type, date, category, amountCents });
  return ok(res, { entry }, 201);
});

entriesRouter.delete('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, '无效的记录 ID');

  const removed = deleteEntry({ userId: req.user.id, id });
  if (!removed) throw new ApiError(404, '记录不存在');
  return ok(res, null);
});
