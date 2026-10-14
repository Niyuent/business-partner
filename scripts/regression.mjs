#!/usr/bin/env node
/**
 * 全量回归入口（S5 起点任务）
 *
 * 用法：npm run regression
 *
 * 流程：seed 一次（固定主键基线）→ 按固定顺序执行各阶段验收脚本 → 任一失败立即停止并以非 0 退出。
 * 覆盖：S1 / S2 / S3.1 / S3.2 / S3.3 / S3.4 / S4.1 / S4.2 / S5.1 / S5.2 / S5.3 / S5.4-A
 *      （S4.3 报表 = curl 用例，见 docs/06）。
 *
 * 约定：各脚本自带数据清理；S3.3 前置已做「历史过期批次归一」，不再依赖执行顺序。
 */
import { execSync } from 'node:child_process';

const SCRIPTS = [
  ['tmp-s1-cases', 'S1 商家与权限（auth/RBAC/入驻/授权/审计）'],
  ['tmp-s2-cases', 'S2 代金券（模板/券码/发放/核销/冲正）'],
  ['tmp-s31-cases', 'S3.1 积分账户/流水/录单/调整/规则'],
  ['tmp-s32-cases', 'S3.2 积分兑换'],
  ['tmp-s33-cases', 'S3.3 积分过期清零'],
  ['tmp-s34-cases', 'S3.4 订单与异常订单处理'],
  ['tmp-s41-cases', 'S4.1 采购记录'],
  ['tmp-s42-cases', 'S4.2 对账账单'],
  ['tmp-s51-cases', 'S5.1 C 端用户鉴权'],
  ['tmp-s52-cases', 'S5.2 用户管理'],
  ['tmp-s53-cases', 'S5.3 门店变更申请'],
  ['tmp-s54a-cases', 'S5.4-A 站内信后端'],
  // S5.4-B（通知：门店已读共享修复 + sender_id + 已发通知 + 前端）落地后在此追加：
  // ['tmp-s54b-cases', 'S5.4-B 通知中心'],
];

const summaryOf = (out) =>
  out.split(/\r?\n/).filter((l) => /=====|结果/.test(l)).slice(-1)[0]?.trim() ?? '(无汇总)';

console.log('===== [regression] 重置 seed 基线 =====');
execSync('docker compose exec -T server npm run prisma:seed', { stdio: 'ignore' });

const results = [];
let failed = false;

for (const [file, title] of SCRIPTS) {
  console.log(`\n===== [regression] ${title} (${file}) =====`);
  try {
    const out = execSync(`node docs/archive/test-scripts/${file}.mjs`, { encoding: 'utf8' });
    process.stdout.write(out);
    results.push({ file, ok: true, line: summaryOf(out) });
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    process.stdout.write(out);
    console.log(`❌ ${file} 失败（exit=${e.status ?? 1}）`);
    results.push({ file, ok: false, line: summaryOf(out) });
    failed = true;
    break; // 失败即停，不跳过
  }
}

console.log('\n===== [regression] 汇总 =====');
for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.file} :: ${r.line}`);
if (failed) {
  console.log('\n结果：存在失败，已停止。');
  process.exit(1);
}
console.log('\n结果：全部通过 ✅');
