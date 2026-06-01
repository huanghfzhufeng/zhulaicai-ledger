/**
 * Preset categories — seeded into the `categories` table on first run.
 * After that the table is the source of truth (owner can add/remove via the UI).
 *
 * owner_only=1 → 仅老板可见（工资/房租/水电/其他、以及全部收入）。
 * owner_only=0 → 经营类（员工也能用来记），含老板后加的自定义支出。
 */
const OPERATIONAL = [
  '淡村采购', '一次性用品', '烧烤冻品进货', '烧烤雪花牛肉', '煤气', '植物油',
  '白切酱油花生油', '半成品鱼片', '饮料', '大米', '配料', '鸭头鸭脚', '员工菜',
];
const OWNER_EXPENSE = ['人工', '房租', '水电', '其他'];
const INCOME = ['营业额', '其他收入'];

export const PRESET_CATEGORIES = Object.freeze([
  ...OPERATIONAL.map((name, i) => ({ type: 'expense', name, owner_only: 0, sort: i })),
  ...OWNER_EXPENSE.map((name, i) => ({ type: 'expense', name, owner_only: 1, sort: 100 + i })),
  ...INCOME.map((name, i) => ({ type: 'income', name, owner_only: 1, sort: i })),
]);

export const ROLES = Object.freeze(['owner', 'staff']);

export function isValidType(type) {
  return type === 'expense' || type === 'income';
}
