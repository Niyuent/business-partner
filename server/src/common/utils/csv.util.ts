/**
 * 统一 CSV 生成（S4.3 抽出，S4.2 对账导出同步复用，保证全站一个格式）
 *
 * 两条硬性约定，缺一个都会在 Excel 里出问题：
 *  1. 前缀 UTF-8 BOM（\uFEFF）—— 不加的话 Excel 打开 UTF-8 CSV 中文全乱码；
 *  2. 字段转义 —— 含逗号 / 双引号 / 换行时必须用双引号包起来并把内部引号翻倍，否则串列。
 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
}
