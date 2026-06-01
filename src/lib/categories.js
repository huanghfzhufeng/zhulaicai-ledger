/**
 * Expense categories for 朱来财大排档. Single source of truth — the frontend
 * fetches this list from /api/categories so the two never drift apart.
 */
export const CATEGORIES = Object.freeze([
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

const CATEGORY_SET = new Set(CATEGORIES);

export function isValidCategory(value) {
  return typeof value === 'string' && CATEGORY_SET.has(value);
}
