/**
 * Categories for 朱来财大排档, by entry type and role.
 * Single source of truth — the frontend fetches the role-appropriate set from
 * /api/categories.
 *
 * 经营类 (operational): day-to-day purchases — staff (员工) may record these.
 * 老板专属 (owner-only) expense categories: 人工/房租/水电/其他 (fixed costs).
 * Income is owner-only. This is how profit & wages stay hidden from staff.
 */
export const OPERATIONAL_CATEGORIES = Object.freeze([
  '淡村采购',
  '一次性用品',
  '烧烤冻品进货',
  '烧烤雪花牛肉',
  '煤气',
  '植物油',
  '白切酱油花生油',
  '半成品鱼片',
  '饮料',
  '大米',
  '配料',
  '鸭头鸭脚',
  '员工菜',
]);

const OWNER_ONLY_EXPENSE = Object.freeze(['人工', '房租', '水电', '其他']);

export const EXPENSE_CATEGORIES = Object.freeze([
  ...OPERATIONAL_CATEGORIES,
  ...OWNER_ONLY_EXPENSE,
]);

export const INCOME_CATEGORIES = Object.freeze(['营业额', '其他收入']);

export const ROLES = Object.freeze(['owner', 'staff']);

const SETS = {
  expense: new Set(EXPENSE_CATEGORIES),
  income: new Set(INCOME_CATEGORIES),
};
const OPERATIONAL_SET = new Set(OPERATIONAL_CATEGORIES);

export function isValidType(type) {
  return type === 'expense' || type === 'income';
}

export function isValidCategory(type, value) {
  return typeof value === 'string' && SETS[type]?.has(value) === true;
}

/** Staff may only record operational expenses (no income, no fixed costs). */
export function isStaffExpenseCategory(value) {
  return typeof value === 'string' && OPERATIONAL_SET.has(value);
}

/** The category lists a given role is allowed to see/use. */
export function categoriesForRole(role) {
  if (role === 'staff') {
    return { expense: OPERATIONAL_CATEGORIES, income: [] };
  }
  return { expense: EXPENSE_CATEGORIES, income: INCOME_CATEGORIES };
}
