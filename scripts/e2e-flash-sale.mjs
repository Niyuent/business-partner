/**
 * 秒杀压测：10 个用户同时兑换库存 5 张的券，再把抢到的 5 张同时核销。
 *
 * 用法：node scripts/e2e-flash-sale.mjs
 * 依赖：docker compose 已启动，admin / clerk01 可登录（密码 Test@123456）。
 * 本脚本自建模板和用户，结束时删掉这些行，不改演示种子里的固定主键。
 */
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost/api/v1';
const ROOT_PWD = readFileSync('.env', 'utf8').match(/^MYSQL_ROOT_PASSWORD=(.+)$/m)[1].trim();
const USER_IDS = Array.from({ length: 10 }, (_, i) => 9201 + i);
const FACE = 8;

function sql(statement) {
  writeFileSync('tmp-e2e-flash.sql', statement + '\n');
  execSync('docker compose cp tmp-e2e-flash.sql mysql:/tmp/e2e-flash.sql', { stdio: 'pipe' });
  execSync(
    `docker compose exec -T mysql bash -c "mysql --default-character-set=utf8mb4 -uroot -p'${ROOT_PWD}' shangmeng < /tmp/e2e-flash.sql"`,
    { stdio: 'pipe' },
  );
}
function query(statement) {
  writeFileSync('tmp-e2e-flash.sql', statement + '\n');
  execSync('docker compose cp tmp-e2e-flash.sql mysql:/tmp/e2e-flash-q.sql', { stdio: 'pipe' });
  return execSync(
    `docker compose exec -T mysql bash -c "mysql --default-character-set=utf8mb4 -uroot -p'${ROOT_PWD}' -N -B shangmeng < /tmp/e2e-flash-q.sql"`,
    { encoding: 'utf8' },
  ).trim();
}

async function call(method, path, token, body) {
  const res = await fetch(BASE + '/' + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json.data, message: json.message, reason: json.data?.reasonCode };
}

function cleanup(templateId) {
  const ids = USER_IDS.join(',');
  const tpl = templateId
    ? String(templateId)
    : query("SELECT IFNULL(GROUP_CONCAT(id), '0') FROM coupon_templates WHERE name LIKE 'E2E秒杀%'") || '0';
  sql(`DELETE FROM redemption_records WHERE userId IN (${ids}) OR code IN (SELECT code FROM coupon_instances WHERE templateId IN (${tpl}));
       UPDATE orders SET couponInstanceId = NULL WHERE userId IN (${ids}) OR orderNo LIKE 'E2E-FLASH-%';
       DELETE FROM orders WHERE userId IN (${ids}) OR orderNo LIKE 'E2E-FLASH-%';
       DELETE FROM exchange_records WHERE userId IN (${ids}) OR templateId IN (${tpl});
       DELETE FROM coupon_instances WHERE userId IN (${ids}) OR templateId IN (${tpl});
       DELETE FROM coupon_codes WHERE templateId IN (${tpl});
       DELETE FROM coupon_code_batches WHERE templateId IN (${tpl});
       DELETE FROM settlement_reports WHERE reportNo LIKE 'SET-2-%' AND reportNo <> 'SET-DEMO-SUB01' AND generatedAt > UTC_TIMESTAMP() - INTERVAL 2 HOUR;
       DELETE FROM point_transactions WHERE userId IN (${ids});
       DELETE FROM point_accounts WHERE userId IN (${ids});
       DELETE FROM users WHERE id IN (${ids});
       DELETE FROM coupon_templates WHERE id IN (${tpl});`);
}

const admin = (await call('POST', 'auth/login', null, { username: 'admin', password: 'Test@123456' })).data?.accessToken;
const clerk = (await call('POST', 'auth/login', null, { username: 'clerk01', password: 'Test@123456' })).data?.accessToken;
if (!admin || !clerk) {
  console.log('登录失败，确认网关和种子账号可用');
  process.exit(1);
}

cleanup(0);

const created = await call('POST', 'coupon-templates', admin, {
  ownerType: 'MAIN_COUPON',
  name: `E2E秒杀-${Date.now()}`,
  faceValue: FACE,
  thresholdAmount: 0,
  totalStock: 5,
  validType: 'AFTER_RECEIVE_DAYS',
  validDays: 30,
  applyScope: 'ALL_STORES',
  pointsCost: 10,
  perUserLimit: 1,
});
const templateId = created.data?.template?.id ?? created.data?.id;
if (!templateId) {
  console.log('建券失败', created.status, created.message);
  process.exit(1);
}
await call('PATCH', `coupon-templates/${templateId}/publish`, admin, {});
const coded = await call('POST', `coupon-templates/${templateId}/codes`, admin, {
  quantity: 10,
  remark: '秒杀压测券码',
});
if (coded.status >= 400) {
  console.log('预生成券码失败', coded.status, coded.reason, coded.message);
  cleanup(templateId);
  process.exit(1);
}

for (const id of USER_IDS) {
  sql(`INSERT INTO users (id, phone, nickname, status, registeredAt, createdAt, updatedAt)
       VALUES (${id}, '1392000${id}', '秒杀${id}', 'ACTIVE', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP());`);
  const adjusted = await call('POST', 'points/adjust', admin, {
    userId: id,
    amount: 100,
    reason: '秒杀压测预置积分',
  });
  if (adjusted.status >= 400) {
    console.log(`用户 ${id} 加积分失败`, adjusted.status, adjusted.reason, adjusted.message);
    cleanup(templateId);
    process.exit(1);
  }
}

const exchanges = await Promise.all(
  USER_IDS.map((userId) =>
    call('POST', 'points/exchange', admin, {
      userId,
      templateId,
      requestId: randomUUID(),
      channel: 'WEB',
    }),
  ),
);
const okEx = exchanges.filter((r) => r.status === 200 || r.status === 201);
const exhausted = exchanges.filter((r) => r.status === 409 && r.reason === 'STOCK_EXHAUSTED');
const other = exchanges.filter((r) => !okEx.includes(r) && !exhausted.includes(r));
const stock = query(
  `SELECT totalStock, issuedCount, totalStock - issuedCount FROM coupon_templates WHERE id=${templateId}`,
);
const [totalStock, issuedCount, remaining] = stock.split('\t').map(Number);
const stockOk = okEx.length === 5 && exhausted.length === 5 && other.length === 0 && issuedCount === 5 && remaining === 0 && remaining >= 0 && issuedCount <= totalStock;
console.log(
  stockOk ? '✅' : '❌',
  `兑换：成功 ${okEx.length}，库存耗尽 ${exhausted.length}，其他 ${other.length}；库存 total=${totalStock} issued=${issuedCount} remaining=${remaining}`,
);
if (!stockOk) {
  console.log(exchanges.map((r) => `${r.status} ${r.reason ?? ''} ${r.message ?? ''}`).join('\n'));
  cleanup(templateId);
  process.exit(1);
}

const codes = okEx.map((r) => r.data?.code).filter(Boolean);
if (codes.length !== 5) {
  console.log('❌ 成功兑换没有返回 5 个券码', okEx.map((r) => JSON.stringify(r.data)).join('\n'));
  cleanup(templateId);
  process.exit(1);
}

const periodStart = new Date(Date.now() - 60_000).toISOString();
const redeems = await Promise.all(
  codes.map((code, i) =>
    call('POST', 'redemptions', clerk, {
      code,
      orderNo: `E2E-FLASH-${Date.now()}-${i}`,
      orderAmount: 100,
      channel: 'MANUAL',
    }),
  ),
);
const okRedeem = redeems.filter((r) => r.status === 200 || r.status === 201);
const successRows = Number(
  query(`SELECT COUNT(*) FROM redemption_records WHERE code IN (${codes.map((c) => `'${c}'`).join(',')}) AND status='SUCCESS'`),
);
const periodEnd = new Date(Date.now() + 60_000).toISOString();
const bill = await call('POST', 'settlements/generate', admin, {
  merchantId: 2,
  periodStart,
  periodEnd,
});
const amountOk = Number(bill.data?.totalAmount) === FACE * 5 && Number(bill.data?.totalCount) === 5;
const redeemOk = okRedeem.length === 5 && successRows === 5 && bill.status < 400 && amountOk;
console.log(
  redeemOk ? '✅' : '❌',
  `核销成功 ${okRedeem.length}，SUCCESS 记录 ${successRows}；对账单 HTTP ${bill.status} 金额 ${bill.data?.totalAmount} 笔数 ${bill.data?.totalCount}（期望 ${FACE * 5} / 5）`,
);
if (!redeemOk) {
  console.log(redeems.map((r) => `${r.status} ${r.reason ?? ''} ${r.message ?? ''}`).join('\n'));
  console.log(JSON.stringify(bill.data ?? bill.message));
}

cleanup(templateId);
try {
  execSync('docker compose exec -T mysql rm -f /tmp/e2e-flash.sql /tmp/e2e-flash-q.sql', { stdio: 'pipe' });
} catch {
  /* 临时 SQL 留在容器里不影响下次 */
}
process.exit(redeemOk ? 0 : 1);
