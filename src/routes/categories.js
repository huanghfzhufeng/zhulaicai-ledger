import { Router } from 'express';
import { ok, ApiError } from '../lib/http.js';
import { isValidType } from '../lib/categories.js';
import { requireAuth, requireOwner } from '../auth/middleware.js';
import { forRole, addCategory, removeCategory, categoryExists } from '../models/categories.js';

export const categoriesRouter = Router();

categoriesRouter.use(requireAuth);

// 按角色返回类别清单（员工只拿经营类、无收入）
categoriesRouter.get('/', (req, res) => ok(res, forRole(req.user.role)));

function parseInput(body) {
  const type = body?.type === 'income' ? 'income' : 'expense';
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!isValidType(type)) throw new ApiError(400, '类型不正确');
  return { type, name };
}

// 添加类别（仅老板）。自定义支出=经营类（员工也能用）；收入本就只有老板。
categoriesRouter.post('/', requireOwner, (req, res) => {
  const { type, name } = parseInput(req.body);
  if (!name || name.length > 12) throw new ApiError(400, '类别名称需为 1-12 个字');
  if (categoryExists(type, name)) throw new ApiError(409, '该类别已存在');
  addCategory({ type, name, ownerOnly: 0 });
  return ok(res, forRole(req.user.role), 201);
});

// 删除类别（仅老板）。只从清单移除，已记的账不受影响。
categoriesRouter.delete('/', requireOwner, (req, res) => {
  const { type, name } = parseInput(req.body);
  if (!name) throw new ApiError(400, '缺少类别名称');
  removeCategory({ type, name });
  return ok(res, forRole(req.user.role));
});
