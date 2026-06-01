import { ApiError } from './http.js';
import { isValidCategory, isValidType } from './categories.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT_CENTS = 1_000_000_000; // 一千万元封顶，防溢出/误输入

/** Validate login input. Just non-empty + sane length — format is not enforced
 *  on login so the configured account can use any username/password. */
export function requireLoginCredentials(body) {
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!username || !password) throw new ApiError(400, '请输入用户名和密码');
  if (username.length > 64 || password.length > 128) throw new ApiError(400, '用户名或密码过长');
  return { username, password };
}

/** Validate a ledger entry payload. Returns { type, date, category, amountCents }. */
export function validateEntryInput(body) {
  const type = body?.type === 'income' ? 'income' : 'expense'; // 兼容老客户端：缺省记为支出
  const date = typeof body?.date === 'string' ? body.date.trim() : '';
  const category = typeof body?.cat === 'string' ? body.cat.trim() : '';
  const amount = Number(body?.amt);

  if (!isValidType(type)) {
    throw new ApiError(400, '类型不正确');
  }
  if (!DATE_RE.test(date) || !isRealDate(date)) {
    throw new ApiError(400, '日期格式不正确');
  }
  if (!isValidCategory(type, category)) {
    throw new ApiError(400, '类别不存在');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, '金额必须为正数');
  }
  const amountCents = Math.round(amount * 100);
  if (amountCents <= 0 || amountCents > MAX_AMOUNT_CENTS) {
    throw new ApiError(400, '金额超出允许范围');
  }
  return { type, date, category, amountCents };
}

function isRealDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
