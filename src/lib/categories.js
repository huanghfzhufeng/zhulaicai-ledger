/**
 * Categories for 朱来财大排档, split by entry type.
 * Single source of truth — the frontend fetches these from /api/categories.
 * Expense list = daily purchases + the monthly fixed costs (人工/房租/水电)
 * that are needed to compute real profit.
 */
export const EXPENSE_CATEGORIES = Object.freeze([
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
  '人工',
  '房租',
  '水电',
  '其他',
]);

export const INCOME_CATEGORIES = Object.freeze(['营业额', '其他收入']);

export const ENTRY_TYPES = Object.freeze(['expense', 'income']);

const SETS = {
  expense: new Set(EXPENSE_CATEGORIES),
  income: new Set(INCOME_CATEGORIES),
};

export function isValidType(type) {
  return type === 'expense' || type === 'income';
}

export function isValidCategory(type, value) {
  return typeof value === 'string' && SETS[type]?.has(value) === true;
}
