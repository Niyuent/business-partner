#!/usr/bin/env node
/**
 * 全量回归入口
 *
 * 用法：npm run regression
 *
 * 流程：seed 一次（固定主键基线）→ 按固定顺序执行各阶段验收脚本 → 任一失败立即停止并以非 0 退出
 *       → **收尾再 seed 一次**（S6-A：把各脚本造的测试数据清掉，环境回到干净基线）。
 * 覆盖：S1 / S2 / S3.1 / S3.2 / S3.3 / S3.4 / S4.1 / S4.2 / S4.3 / S5.1–S5.5。
 *
 * 为什么要有「收尾重置」：
 *   部分历史脚本（如 tmp-s31 用 mkOrder 直接 SQL 造订单，其中包含故意错配 merchantId/storeId 的
 *   越权用例数据）跑完不会清理，会以「列表里商户与门店不匹配」的形式污染后续手工验收。
 *   单个脚本自清理已尽力补（见各脚本末尾），但收尾统一重置是**兜底保证**：
 *   无论脚本成功、失败还是中途中断，回归走完环境一定是干净的。
 *
 * 单跑某个脚本后想恢复干净环境：npm run db:reset
 */
import { execSync } from 'node:child_process';

/** 重置到 seed 基线（seed 内部按外键顺序 deleteMany 全部业务表，等价于一次干净重建） */
function seedBaseline(label) {
  console.log(`===== [regression] ${label} =====`);
  execSync('docker compose exec -T server npm run prisma:seed', { stdio: 'ignore' });
}

const SCRIPTS = [
  ['tmp-s1-cases', 'S1 商家与权限（auth/RBAC/入驻/授权/审计）'],
  ['tmp-s2-cases', 'S2 代金券（模板/券码/发放/核销/冲正）'],
  ['tmp-s31-cases', 'S3.1 积分账户/流水/录单/调整/规则'],
  ['tmp-s32-cases', 'S3.2 积分兑换'],
  ['tmp-s33-cases', 'S3.3 积分过期清零'],
  ['tmp-s34-cases', 'S3.4 订单与异常订单处理'],
  ['tmp-s41-cases', 'S4.1 采购记录'],
  ['tmp-s42-cases', 'S4.2 对账账单'],
  ['tmp-s43-cases', 'S4.3 报表中心（6 张报表 + 导出 + 隔离）'],
  ['tmp-s51-cases', 'S5.1 C 端用户鉴权'],
  ['tmp-s52-cases', 'S5.2 用户管理'],
  ['tmp-s53-cases', 'S5.3 门店变更申请'],
  ['tmp-s54a-cases', 'S5.4-A 站内信后端'],
  ['tmp-s54b1-cases', 'S5.4-B1 通知每人各自已读 + 我发过的 + 口径统一'],
  ['tmp-s54b2-cases', 'S5.4-B2 通知中心（收件箱/发件箱 + 某批收件人接口）'],
];

const summaryOf = (out) =>
  out.split(/\r?\n/).filter((l) => /=====|结果/.test(l)).slice(-1)[0]?.trim() ?? '(无汇总)';

seedBaseline('重置 seed 基线');

const results = [];
let failed = false;

try {
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
} finally {
  // S6-A 兜底：无论成功、失败还是中途异常，跑完统一回到干净基线。
  // 历史脚本会造交叉 merchantId/storeId 的测试订单（越权用例需要），不清理会污染后续手工验收。
  try {
    seedBaseline('收尾重置（清理测试脏数据）');
  } catch (e) {
    console.log(`⚠️ 收尾重置失败：${e.message ?? e}\n   请手动执行 npm run db:reset`);
  }
}

console.log('\n===== [regression] 汇总 =====');
for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.file} :: ${r.line}`);
if (failed) {
  console.log('\n结果：存在失败，已停止。');
  process.exit(1);
}
console.log('\n结果：全部通过 ✅');
