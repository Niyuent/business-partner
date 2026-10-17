/**
 * S3.1 验收用例（回归）：积分账户 + 积分流水 + 消费录单 + 人工调整 + 规则
 * 全部走真实 HTTP（http://localhost/api/v1）；自建用户/批次/订单，最小依赖 seed。
 * 覆盖：成功 11 / 失败 13 / 并发幂等 3。
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost/api/v1';
const ROOT_PWD = readFileSync('.env', 'utf8').match(/^MYSQL_ROOT_PASSWORD=(.+)$/m)[1].trim();
const ok200 = (s) => s >= 200 && s < 300;
let pass = 0;
let fail = 0;
const log = (s) => console.log(s);
function ok(section, label, cond, detail) {
  if (cond) pass++;
  else fail++;
  log(`${cond ? '✅' : '❌'} [${section}] ${label} :: ${detail}`);
}

async function call(method, path, token, body, params) {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)).toString()
    : '';
  const res = await fetch(BASE + '/' + path + qs, {
    method,
    headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, data: j.data, msg: j.message, reason: j.data?.reasonCode };
}
const login = async (u) => (await call('POST', 'auth/login', null, { username: u, password: 'Test@123456' })).data?.accessToken ?? null;

function sql(statement) {
  writeFileSync('tmp-s31.sql', statement + '\n');
  execSync('docker compose cp tmp-s31.sql mysql:/tmp/s31x.sql', { stdio: 'pipe' });
  execSync(`docker compose exec -T mysql bash -c "mysql --default-character-set=utf8mb4 -uroot -p'${ROOT_PWD}' shangmeng < /tmp/s31x.sql"`, { stdio: 'pipe' });
}
function query(statement) {
  writeFileSync('tmp-s31.sql', statement + '\n');
  execSync('docker compose cp tmp-s31.sql mysql:/tmp/s31q.sql', { stdio: 'pipe' });
  return execSync(`docker compose exec -T mysql bash -c "mysql --default-character-set=utf8mb4 -uroot -p'${ROOT_PWD}' -N -B shangmeng < /tmp/s31q.sql"`, { encoding: 'utf8' }).trim();
}
const scalar = (stmt) => query(stmt).split('\n')[0]?.trim() ?? '';

const A = await login('admin');
const S1 = await login('sub01');
const S2 = await login('sub02');
const CK = await login('clerk01');

const isoDay = (days) => new Date(Date.now() + days * 86400_000).toISOString();

/** 重置用户（清历史积分数据 + 建用户） */
async function mkUser(id, name, phone) {
  sql(
    `DELETE FROM redemption_records WHERE userId = ${id};
     UPDATE orders SET couponInstanceId = NULL WHERE userId = ${id};
     DELETE FROM exchange_records WHERE userId = ${id};
     DELETE FROM coupon_instances WHERE userId = ${id};
     DELETE FROM point_transactions WHERE userId = ${id};
     DELETE FROM point_accounts WHERE userId = ${id};
     INSERT INTO users (id, phone, nickname, status, registeredAt, createdAt, updatedAt) VALUES (${id}, '${phone}', '${name}', 'ACTIVE', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE nickname='${name}';`,
  );
}
const mkBatch = (userId, amount, days, reason) =>
  call('POST', 'points/adjust', A, { userId, amount, reason, expireAt: isoDay(days) });
function mkOrder(orderNo, userId, merchantId, storeId, amount) {
  sql(`INSERT INTO orders (orderNo, userId, merchantId, storeId, totalAmount, payAmount, orderType, source, consumeTime, createdAt, updatedAt)
       VALUES ('${orderNo}', ${userId}, ${merchantId}, ${storeId}, ${amount}, ${amount}, 'CONSUME', 'IMPORT', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE totalAmount=VALUES(totalAmount);`);
}

// ===================== 成功用例 =====================
log('———— 成功用例 ————');

// 1. 账户列表（含临期字段）
{
  const r = await call('GET', 'point-accounts', A, null, { page: 1, pageSize: 5 });
  const item = (r.data?.list ?? [])[0];
  ok('S1', '账户列表 200 且含 balance/expiringSoon 字段',
    r.status === 200 && Array.isArray(r.data?.list) && item && 'balance' in item && 'expiringSoon' in item,
    `HTTP=${r.status} total=${r.data?.total} keys=${item ? Object.keys(item).join(',') : '-'}`);
}

// 2. 账户详情：available(可用) ≠ balance(账面) + 过期批次 usable=false
{
  await mkUser(1090, '回归A', '13800109000');
  await mkBatch(1090, 80, -5, 'S3.1 批次A：80分 已过期');
  await mkBatch(1090, 40, 30, 'S3.1 批次B：40分 未过期');
  const r = await call('GET', 'point-accounts/1090', A);
  const expBatch = (r.data?.batches ?? []).find((b) => b.usable === false);
  ok('S2', '详情 balance=120 且 available=40（过期 80 不计入可用）',
    r.status === 200 && r.data.account.balance === 120 && r.data.summary.available === 40,
    `balance=${r.data?.account?.balance} available=${r.data?.summary?.available}`);
  ok('S2', '过期批次 usable=false', !!expBatch, `expiredBatch=${JSON.stringify(expBatch ?? null).slice(0, 80)}`);
}

// 3/4. 录单送分（+100，有效期 +12 月）+ 余额精确累加
{
  await mkUser(1091, '回归B', '13800109001');
  mkOrder('ORD-S31-E1', 1091, 1, 101, 100);
  const r = await call('POST', 'points/earn', A, { userId: 1091, amount: 100, merchantId: 1, orderNo: 'ORD-S31-E1' });
  const acc = await call('GET', 'point-accounts/1091', A);
  ok('S3', '录单送分 201 且 points=100', r.status === 201 && r.data?.points === 100, `HTTP=${r.status} points=${r.data?.points}`);
  const earnTxn = await call('GET', 'point-transactions', A, null, { userId: 1091, type: 'EARN', pageSize: 5 });
  const expireAt = earnTxn.data?.list?.[0]?.expireAt ? new Date(earnTxn.data.list[0].expireAt) : null;
  const months = expireAt ? Math.round((expireAt - Date.now()) / (30 * 86400_000)) : -1;
  ok('S3', 'EARN 批次有效期约 +12 月', months >= 11 && months <= 13, `expireAt=${earnTxn.data?.list?.[0]?.expireAt} (~${months} 月)`);
  ok('S4', '余额精确累加 = 100', acc.data?.account?.balance === 100, `balance=${acc.data?.account?.balance}`);
}

// 5/6. 人工 +50 → ADJUST 流水 + 审计
{
  const r = await call('POST', 'points/adjust', A, { userId: 1091, amount: 50, reason: 'S3.1 回归补偿：客诉补分' });
  const adj = await call('GET', 'point-transactions', A, null, { userId: 1091, type: 'ADJUST', pageSize: 5 });
  const auditCnt = Number(scalar(`SELECT COUNT(*) FROM audit_logs WHERE module='point' AND action='point:adjust'`));
  ok('S5', '人工 +50 成功且生成 ADJUST 流水', ok200(r.status) && adj.data?.total === 1 && adj.data.list[0].amount === 50,
    `HTTP=${r.status} ADJUST=${adj.data?.total} amount=${adj.data?.list?.[0]?.amount}`);
  ok('S6', 'adjust 写 audit_logs', auditCnt >= 1, `audit=${auditCnt}`);
}

// 7. 流水 type 筛选 ×2
{
  const e = await call('GET', 'point-transactions', A, null, { userId: 1091, type: 'EARN' });
  const a = await call('GET', 'point-transactions', A, null, { userId: 1091, type: 'ADJUST' });
  ok('S7', 'type=EARN 仅返回 EARN、type=ADJUST 仅返回 ADJUST',
    e.data?.total === 1 && e.data.list.every((x) => x.type === 'EARN') && a.data?.total === 1 && a.data.list.every((x) => x.type === 'ADJUST'),
    `EARN=${e.data?.total} ADJUST=${a.data?.total}`);
}

// 8. 规则列表 + 修改（写审计）+ 还原
{
  const list = await call('GET', 'point-rules', A);
  const rules = list.data?.list ?? list.data ?? [];
  const mine = rules.find((x) => x.merchantId === 1);
  const platform = rules.find((x) => x.merchantId === 0);
  ok('S8', '规则列表含平台默认(merchantId=0)与商家(merchantId=1)', !!mine && !!platform, `rules=${rules.map((x) => `${x.id}/m${x.merchantId}`).join(' ')}`);
  const upd = await call('PUT', `point-rules/${mine.id}`, A, { earnRatio: 2 });
  const after = await call('GET', 'point-rules', A);
  const afterRule = (after.data?.list ?? after.data ?? []).find((x) => x.id === mine.id);
  const auditCnt = Number(scalar(`SELECT COUNT(*) FROM audit_logs WHERE module='point' AND action='point:rule:update'`));
  ok('S8', '修改规则 earnRatio=2 生效并写审计', ok200(upd.status) && Number(afterRule.earnRatio) === 2 && auditCnt >= 1,
    `HTTP=${upd.status} earnRatio=${afterRule?.earnRatio} audit=${auditCnt}`);
  await call('PUT', `point-rules/${mine.id}`, A, { earnRatio: 1 }); // 还原
  log(`  （已还原 earnRatio=1）`);
}

// 9. FIFO 扣减顺序（先扣早过期批次）
{
  await mkUser(1092, '回归C', '13800109002');
  await mkBatch(1092, 50, 10, 'S3.1 FIFO 批次A：50分 10天');
  await mkBatch(1092, 80, 30, 'S3.1 FIFO 批次B：80分 30天');
  const before = await call('GET', 'point-accounts/1092', A);
  const [bA, bB] = before.data.batches.slice().sort((x, y) => new Date(x.expireAt) - new Date(y.expireAt));
  await call('POST', 'points/adjust', A, { userId: 1092, amount: -30, reason: 'S3.1 FIFO 扣减验证' });
  const after = await call('GET', 'point-accounts/1092', A);
  const m = new Map(after.data.batches.map((b) => [b.id, b.remainingAmount]));
  ok('S9', 'FIFO 先扣早过期批次A(50→20)、B(80 不动)',
    (m.get(bA.id) ?? 0) === 20 && (m.get(bB.id) ?? 0) === 80, `A=${m.get(bA.id) ?? 0} B=${m.get(bB.id) ?? 0}`);
}

// 10. 店员录单（门店由 JWT 推导）
{
  await mkUser(1093, '回归D', '13800109003');
  mkOrder('ORD-S31-C1', 1093, 2, 101, 60);
  const r = await call('POST', 'points/earn', CK, { userId: 1093, amount: 60, orderNo: 'ORD-S31-C1' });
  ok('S10', '店员立单送分 201（门店由 JWT 推导）', r.status === 201 && r.data?.points === 60, `HTTP=${r.status} points=${r.data?.points}`);
}

// 11. 附属录单
{
  await mkUser(1094, '回归E', '13800109004');
  mkOrder('ORD-S31-S1', 1094, 2, 101, 40);
  const r = await call('POST', 'points/earn', S1, { userId: 1094, amount: 40, orderNo: 'ORD-S31-S1' });
  ok('S11', '附属商家录单送分 201', r.status === 201 && r.data?.points === 40, `HTTP=${r.status} points=${r.data?.points}`);
}

// ===================== 失败用例 =====================
log('');
log('———— 失败用例 ————');

{ // F1 用户不存在 404
  const r = await call('POST', 'points/adjust', A, { userId: 999999, amount: 10, reason: '用户不存在回归验证' });
  ok('F1', '用户不存在 → 404', r.status === 404, `HTTP=${r.status} ${r.reason ?? r.msg}`);
}
{ // F2 订单不属于该用户 400
  const r = await call('POST', 'points/earn', A, { userId: 1091, amount: 10, merchantId: 1, orderNo: 'ORD-S31-C1' });
  ok('F2', '订单不属于该用户 → 400', r.status === 400, `HTTP=${r.status} ${r.reason ?? r.msg}`);
}
{ // F3 同订单重复送分 409
  const r = await call('POST', 'points/earn', A, { userId: 1091, amount: 100, merchantId: 1, orderNo: 'ORD-S31-E1' });
  ok('F3', '同订单重复送分 → 409 ORDER_POINTS_ALREADY_EARNED',
    r.status === 409 && r.reason === 'ORDER_POINTS_ALREADY_EARNED', `HTTP=${r.status} ${r.reason}`);
}
{ // F4 原因 <5 字符 400
  const r = await call('POST', 'points/adjust', A, { userId: 1091, amount: 10, reason: '短' });
  ok('F4', '原因 <5 字符 → 400', r.status === 400, `HTTP=${r.status} ${r.msg}`);
}
{ // F5 零调整 400 INVALID_ADJUST_AMOUNT
  const r = await call('POST', 'points/adjust', A, { userId: 1091, amount: 0, reason: '零调整回归验证' });
  ok('F5', '零调整 → 400 INVALID_ADJUST_AMOUNT', r.status === 400 && r.reason === 'INVALID_ADJUST_AMOUNT', `HTTP=${r.status} ${r.reason}`);
}
{ // F6 超额扣减（过期批次不算）
  await mkUser(1095, '回归F', '13800109005');
  await mkBatch(1095, 100, -5, 'S3.1 仅有过期批次：超额扣减');
  const r = await call('POST', 'points/adjust', A, { userId: 1095, amount: -50, reason: '超额扣减回归验证' });
  ok('F6', '超额扣减（过期批次不算）→ 409 BALANCE_NOT_ENOUGH', r.status === 409 && r.reason === 'BALANCE_NOT_ENOUGH', `HTTP=${r.status} ${r.reason}`);
}
{ // F7 附属查别家流水 403
  const r = await call('GET', 'point-transactions', S2, null, { userId: 1091, merchantId: 1 });
  ok('F7', '附属查别家(merchant 1)流水 → 403 FORBIDDEN_SCOPE', r.status === 403 && r.reason === 'FORBIDDEN_SCOPE', `HTTP=${r.status} ${r.reason}`);
}
{ // F8 附属查无本店流水用户 403
  const r = await call('GET', 'point-accounts/1091', S2);
  ok('F8', '附属查无本店流水用户 → 403 FORBIDDEN_SCOPE', r.status === 403 && r.reason === 'FORBIDDEN_SCOPE', `HTTP=${r.status} ${r.reason}`);
}
{ // F9 店员调整 403
  const r = await call('POST', 'points/adjust', CK, { userId: 1091, amount: 10, reason: '店员调整应被拒' });
  ok('F9', '店员人工调整 → 403 PERMISSION_DENIED', r.status === 403 && r.reason === 'PERMISSION_DENIED', `HTTP=${r.status} ${r.reason}`);
}
{ // F10 附属改平台规则 403
  const list = await call('GET', 'point-rules', A);
  const platform = (list.data?.list ?? list.data ?? []).find((x) => x.merchantId === 0);
  const r = await call('PUT', `point-rules/${platform.id}`, S1, { earnRatio: 3 });
  ok('F10', '附属改平台规则 → 403', r.status === 403, `HTTP=${r.status} ${r.reason}`);
}
{ // F11 传别家 merchantId 403
  mkOrder('ORD-S31-X1', 1091, 1, 101, 10);
  const r = await call('POST', 'points/earn', S1, { userId: 1091, amount: 10, merchantId: 3, orderNo: 'ORD-S31-X1' });
  ok('F11', '附属传别家 merchantId → 403 FORBIDDEN_SCOPE', r.status === 403 && r.reason === 'FORBIDDEN_SCOPE', `HTTP=${r.status} ${r.reason}`);
}
{ // F12 店员传别家门店 403 STORE_NOT_OWNED
  mkOrder('ORD-S31-X2', 1093, 2, 201, 10);
  const r = await call('POST', 'points/earn', CK, { userId: 1093, amount: 10, storeId: 201, orderNo: 'ORD-S31-X2' });
  ok('F12', '店员传别家门店 → 403 STORE_NOT_OWNED', r.status === 403 && r.reason === 'STORE_NOT_OWNED', `HTTP=${r.status} ${r.reason}`);
}
{ // F13 未达起送金额 → 201 + earned:false
  mkOrder('ORD-S31-ZERO', 1091, 1, 101, 0.5);
  const r = await call('POST', 'points/earn', A, { userId: 1091, amount: 0.5, merchantId: 1, orderNo: 'ORD-S31-ZERO' });
  ok('F13', '未达起送金额 → 201 + earned:false', r.status === 201 && r.data?.earned === false, `HTTP=${r.status} earned=${r.data?.earned} points=${r.data?.points}`);
}

// ===================== 并发与幂等 =====================
log('');
log('———— 并发与幂等 ————');

{ // C1 并发录单同一订单
  await mkUser(1096, '回归G', '13800109006');
  mkOrder('ORD-S31-CC1', 1096, 1, 101, 100);
  const [c1, c2] = await Promise.all([
    call('POST', 'points/earn', A, { userId: 1096, amount: 100, merchantId: 1, orderNo: 'ORD-S31-CC1' }),
    call('POST', 'points/earn', A, { userId: 1096, amount: 100, merchantId: 1, orderNo: 'ORD-S31-CC1' }),
  ]);
  const bal = (await call('GET', 'point-accounts/1096', A)).data?.account?.balance;
  const okc = [c1, c2].filter((x) => x.status === 201).length;
  const conf = [c1, c2].filter((x) => x.status === 409).length;
  ok('C1', '并发录单同一订单 → 1×201 + 1×409，余额 +100（不翻倍）',
    okc === 1 && conf === 1 && bal === 100, `HTTP=${c1.status}/${c2.status} balance=${bal}`);
}
{ // C2 同用户两笔不同订单并发
  await mkUser(1097, '回归H', '13800109007');
  mkOrder('ORD-S31-D1', 1097, 1, 101, 10);
  mkOrder('ORD-S31-D2', 1097, 1, 101, 20);
  const [c1, c2] = await Promise.all([
    call('POST', 'points/earn', A, { userId: 1097, amount: 10, merchantId: 1, orderNo: 'ORD-S31-D1' }),
    call('POST', 'points/earn', A, { userId: 1097, amount: 20, merchantId: 1, orderNo: 'ORD-S31-D2' }),
  ]);
  const bal = (await call('GET', 'point-accounts/1097', A)).data?.account?.balance;
  ok('C2', '同用户两笔不同订单并发 → 都 201，余额精确 +30',
    c1.status === 201 && c2.status === 201 && bal === 30,
    `HTTP=${c1.status}/${c2.status} reason=${c1.reason ?? '-'}/${c2.reason ?? '-'} balance=${bal}`);
}
{ // C2b 新用户首两笔不同订单并发录单（S4 收口修复回归：ensureAccount 竞态）
  await mkUser(1099, '回归J', '13800109009');
  mkOrder('ORD-S31-E2', 1099, 1, 101, 10);
  mkOrder('ORD-S31-E3', 1099, 1, 101, 20);
  const [c1, c2] = await Promise.all([
    call('POST', 'points/earn', A, { userId: 1099, amount: 10, merchantId: 1, orderNo: 'ORD-S31-E2' }),
    call('POST', 'points/earn', A, { userId: 1099, amount: 20, merchantId: 1, orderNo: 'ORD-S31-E3' }),
  ]);
  const bal = (await call('GET', 'point-accounts/1099', A)).data?.account?.balance;
  const earnCnt = Number(scalar(`SELECT COUNT(*) FROM point_transactions WHERE userId=1099 AND type='EARN'`));
  const acctCnt = Number(scalar(`SELECT COUNT(*) FROM point_accounts WHERE userId=1099`));
  ok('C2b', '新用户首两笔不同订单并发 → 都 201，余额 +30，2 条 EARN',
    c1.status === 201 && c2.status === 201 && bal === 30 && earnCnt === 2,
    `HTTP=${c1.status}/${c2.status} reason=${c1.reason ?? '-'}/${c2.reason ?? '-'} balance=${bal} EARN=${earnCnt}`);
  ok('C2b', '只创建 1 个积分账户', acctCnt === 1, `accounts=${acctCnt}`);
}
{ // C3 并发人工调整扣减
  await mkUser(1098, '回归I', '13800109008');
  await mkBatch(1098, 100, 30, 'S3.1 并发扣减：100分');
  const [c1, c2] = await Promise.all([
    call('POST', 'points/adjust', A, { userId: 1098, amount: -10, reason: 'S3.1 并发扣减A' }),
    call('POST', 'points/adjust', A, { userId: 1098, amount: -10, reason: 'S3.1 并发扣减B' }),
  ]);
  const bal = (await call('GET', 'point-accounts/1098', A)).data?.account?.balance;
  ok('C3', '并发人工扣减 → 精确扣 20，无 500、无负数',
    ok200(c1.status) && ok200(c2.status) && bal === 80, `HTTP=${c1.status}/${c2.status} balance=${bal}`);
}

// ===================== 清理（S6-A） =====================
// 本脚本用 mkOrder 直接 SQL 造订单，其中 F11 / F12 / F13 等越权用例**故意**使用
// 「A 商家的 merchantId + B 商家的 storeId」错配数据（例：ORD-S31-X2 = merchantId 2 + storeId 201），
// 不清理会让订单列表出现「商户与门店不匹配」的脏数据，污染后续手工验收。
// 只删未被 coupon_instances 引用的行（orders 仅被该表外键引用），避免外键报错；
// 若仍有残留，执行 npm run db:reset 兜底。
try {
  sql(`DELETE FROM orders WHERE orderNo LIKE 'ORD-S31-%'
         AND id NOT IN (SELECT orderId FROM coupon_instances WHERE orderId IS NOT NULL);`);
  const left = scalar(`SELECT COUNT(*) FROM orders WHERE orderNo LIKE 'ORD-S31-%';`);
  log(`  （已清理 ORD-S31-* 测试订单，剩余 ${left} 条：被券实例引用，保留）`);
} catch (e) {
  log(`  ⚠️ 订单清理失败：${e.message}（可执行 npm run db:reset 兜底）`);
}

log(`\n===== S3.1 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail === 0 ? 0 : 1);
