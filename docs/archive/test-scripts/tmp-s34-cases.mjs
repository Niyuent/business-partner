/**
 * S3.4 验收用例：订单管理 + 异常订单处理（取消回退 / FIFO 边界 / 审计 / 并发 / 权限隔离）
 * 全部走真实 HTTP（http://localhost/api/v1）；EARN/SPEND/券/订单用 SQL 直插（可控批次与金额）。
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost/api/v1';
const ROOT_PWD = readFileSync('.env', 'utf8').match(/^MYSQL_ROOT_PASSWORD=(.+)$/m)[1].trim();
let pass = 0;
let fail = 0;
const log = (s) => console.log(s);
function ok(section, label, cond, detail) {
  if (cond) pass++;
  else fail++;
  log(`${cond ? '✅' : '❌'} [${section}] ${label} :: ${detail}`);
}

async function call(method, path, token, body) {
  const res = await fetch(BASE + '/' + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, data: j.data, msg: j.message, reason: j.data?.reasonCode };
}
const login = async (u) => (await call('POST', 'auth/login', null, { username: u, password: 'Test@123456' })).data?.accessToken ?? null;

function sql(statement) {
  writeFileSync('tmp-s34.sql', statement + '\n');
  execSync('docker compose cp tmp-s34.sql mysql:/tmp/s34x.sql', { stdio: 'pipe' });
  execSync(`docker compose exec -T mysql bash -c "mysql --default-character-set=utf8mb4 -uroot -p'${ROOT_PWD}' shangmeng < /tmp/s34x.sql"`, { stdio: 'pipe' });
}
function query(statement) {
  writeFileSync('tmp-s34.sql', statement + '\n');
  execSync('docker compose cp tmp-s34.sql mysql:/tmp/s34q.sql', { stdio: 'pipe' });
  return execSync(`docker compose exec -T mysql bash -c "mysql --default-character-set=utf8mb4 -uroot -p'${ROOT_PWD}' -N -B shangmeng < /tmp/s34q.sql"`, { encoding: 'utf8' }).trim();
}
const scalar = (stmt) => query(stmt).split('\n')[0]?.trim() ?? '';

const A = await login('admin');
const P = await login('platform');
const S1 = await login('sub01');
const S2 = await login('sub02');

const FUTURE = "UTC_TIMESTAMP() + INTERVAL 30 DAY";
const PAST = "UTC_TIMESTAMP() - INTERVAL 1 DAY";

/** 清掉某用户的订单/券/核销/积分（按外键顺序） */
function resetUser(userId) {
  sql(`DELETE FROM redemption_records WHERE userId=${userId};
       UPDATE orders SET couponInstanceId=NULL WHERE userId=${userId};
       DELETE FROM orders WHERE userId=${userId};
       DELETE FROM exchange_records WHERE userId=${userId};
       DELETE FROM coupon_instances WHERE userId=${userId};
       DELETE FROM point_transactions WHERE userId=${userId};
       DELETE FROM point_accounts WHERE userId=${userId};`);
}

/** 建用户 + 账户 + 若干 EARN 批次（txnId 固定，可控 remainingAmount / expireAt） */
function seedEarn(userId, accountId, batches, balance, totalEarned) {
  const totalSpent = totalEarned - balance;
  sql(`INSERT INTO users (id, phone, nickname, status, registeredAt, createdAt, updatedAt) VALUES (${userId},'13${userId}','S34-${userId}','ACTIVE',UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE nickname='S34-${userId}';
       INSERT INTO point_accounts (id, userId, balance, totalEarned, totalSpent, totalExpired, version, updatedAt) VALUES (${accountId},${userId},${balance},${totalEarned},${totalSpent},0,0,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE balance=${balance},totalEarned=${totalEarned},totalSpent=${totalSpent},totalExpired=0,version=0;`);
  const rows = batches.map((b) => `(${b.txnId},${userId},${accountId},'EARN',${b.points},${b.remaining},${balance},${b.expireSql},1,NULL,NULL,'s34-e${b.txnId}',UTC_TIMESTAMP())`).join(',');
  sql(`INSERT INTO point_transactions (id, userId, accountId, type, amount, remainingAmount, balanceAfter, expireAt, merchantId, storeId, operatorId, remark, createdAt) VALUES ${rows};`);
}

/** 建券实例 + SPEND 流水 + 订单（ABNORMAL）+ 核销记录 */
function seedOrderWithCoupon(orderNo, userId, accountId, merchantId, couponId, templateId, pointsCost, spends, orderStatus) {
  // 券实例（USED，模拟已核销）
  sql(`INSERT INTO coupon_instances (id, userId, templateId, code, issuerMerchantId, source, pointsCost, status, obtainedAt, expireAt, usedAt, createdAt, updatedAt)
       VALUES (${couponId}, ${userId}, ${templateId}, 'S34CODE${couponId}', ${merchantId}, 'EXCHANGE', ${pointsCost}, 'USED', UTC_TIMESTAMP(), ${FUTURE}, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP());`);
  // SPEND 流水（每条带 sourceTransactionId 指回 EARN 批次）
  const spendRows = spends.map((s) => `(${userId},${accountId},'SPEND',${-s.amount},0,0,${couponId},${s.sourceTxnId},${merchantId},NULL,NULL,'s34-spend',UTC_TIMESTAMP())`).join(',');
  sql(`INSERT INTO point_transactions (userId, accountId, type, amount, remainingAmount, balanceAfter, relatedCouponInstanceId, sourceTransactionId, merchantId, storeId, operatorId, remark, createdAt) VALUES ${spendRows};`);
  // 订单（异常）
  sql(`INSERT INTO orders (orderNo, userId, merchantId, storeId, orderType, totalAmount, discountAmount, payAmount, couponInstanceId, pointsEarned, status, abnormalType, abnormalRemark, source, consumeTime, createdAt, updatedAt)
       VALUES ('${orderNo}', ${userId}, ${merchantId}, NULL, 'CONSUME', 100, 0, 100, ${couponId}, 0, '${orderStatus}', 'STORE_DISPUTE', '门店争议异常', 'IMPORT', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP());`);
}

function acct(userId) { return scalar(`SELECT CONCAT(balance,'|',totalSpent,'|',totalExpired) FROM point_accounts WHERE userId=${userId}`); }
function remain(txnId) { return Number(scalar(`SELECT remainingAmount FROM point_transactions WHERE id=${txnId}`)); }
function orderRow(orderNo) { return scalar(`SELECT CONCAT(status,'|',IFNULL(couponInstanceId,'NULL'),'|',IFNULL(handleResult,'NULL'),'|',IFNULL(handledBy,'NULL')) FROM orders WHERE orderNo='${orderNo}'`); }
function couponStatus(couponId) { return scalar(`SELECT status FROM coupon_instances WHERE id=${couponId}`); }
function refundRows(userId) { return Number(scalar(`SELECT COUNT(*) FROM point_transactions WHERE userId=${userId} AND type='REFUND'`)); }
function refundSources(userId) { return scalar(`SELECT GROUP_CONCAT(sourceTransactionId ORDER BY id) FROM point_transactions WHERE userId=${userId} AND type='REFUND'`); }

// ---------------------------------------------------------------- 用例 1：订单取消完整回退
{
  resetUser(3001);
  const E1 = 90001;
  seedEarn(3001, 53001, [{ txnId: E1, points: 100, remaining: 50, expireSql: FUTURE }], 50, 100);
  seedOrderWithCoupon('ORD-S34-C1', 3001, 53001, 1, 7001, 1002, 50, [{ amount: 50, sourceTxnId: E1 }], 'ABNORMAL');
  const oid = Number(scalar(`SELECT id FROM orders WHERE orderNo='ORD-S34-C1'`));
  const r2 = await call('POST', `orders/${oid}/handle`, A, { handleType: 'CANCEL' });
  ok('用例1', '处理返回成功（status=CANCELED）', r2.status === 201 && r2.data?.status === 'CANCELED', `status=${r2.status} data.status=${r2.data?.status}`);
  ok('用例1', '券回 UNUSED', couponStatus(7001) === 'UNUSED', `coupon=${couponStatus(7001)}`);
  ok('用例1', '订单 couponInstanceId 清空', orderRow('ORD-S34-C1').startsWith('CANCELED|NULL'), `order=${orderRow('ORD-S34-C1')}`);
  ok('用例1', 'EARN 批次 remaining 恢复 100', remain(E1) === 100, `remain=${remain(E1)}`);
  ok('用例1', '生成 1 条 REFUND 流水 + source 指回 E1', refundRows(3001) === 1 && refundSources(3001) === String(E1), `refund=${refundRows(3001)} src=${refundSources(3001)}`);
  ok('用例1', '账户 balance 回 100 / totalSpent 回 0', acct(3001) === '100|0|0', `acct=${acct(3001)}`);
  const auditCnt = Number(scalar(`SELECT COUNT(*) FROM audit_logs WHERE module='order' AND action='ORDER_HANDLE' AND targetId=${oid}`));
  ok('用例1', '审计日志完整（ORDER_HANDLE）', auditCnt >= 1, `audit=${auditCnt}`);
}

// ---------------------------------------------------------------- 用例 2：FIFO 边界（B、C 两批回退）
{
  resetUser(3002);
  const B = 90010, C = 90011;
  seedEarn(3002, 53002, [{ txnId: B, points: 40, remaining: 0, expireSql: FUTURE }, { txnId: C, points: 60, remaining: 0, expireSql: FUTURE }], 0, 100);
  seedOrderWithCoupon('ORD-S34-C2', 3002, 53002, 1, 7002, 1002, 100, [{ amount: 40, sourceTxnId: B }, { amount: 60, sourceTxnId: C }], 'ABNORMAL');
  const oid = Number(scalar(`SELECT id FROM orders WHERE orderNo='ORD-S34-C2'`));
  const r = await call('POST', `orders/${oid}/handle`, A, { handleType: 'CANCEL' });
  ok('用例2', 'B.remaining 恢复 40', remain(B) === 40, `B.remain=${remain(B)}`);
  ok('用例2', 'C.remaining 恢复 60', remain(C) === 60, `C.remain=${remain(C)}`);
  ok('用例2', '生成 2 条 REFUND，source 指回 B、C', refundRows(3002) === 2 && refundSources(3002) === `${B},${C}`, `refund=${refundRows(3002)} src=${refundSources(3002)}`);
  ok('用例2', '账户 balance 回 100', acct(3002) === '100|0|0', `acct=${acct(3002)}`);
}

// ---------------------------------------------------------------- 用例 2b：B 已过期，回退后仍过期（不复活）
{
  resetUser(3003);
  const B = 90020, C = 90021;
  seedEarn(3003, 53003, [{ txnId: B, points: 40, remaining: 0, expireSql: FUTURE }, { txnId: C, points: 60, remaining: 0, expireSql: FUTURE }], 0, 100);
  seedOrderWithCoupon('ORD-S34-C2B', 3003, 53003, 1, 7003, 1002, 100, [{ amount: 40, sourceTxnId: B }, { amount: 60, sourceTxnId: C }], 'ABNORMAL');
  // 模拟 B 在退款前已过期
  sql(`UPDATE point_transactions SET expireAt = ${PAST} WHERE id = ${B};`);
  const oid = Number(scalar(`SELECT id FROM orders WHERE orderNo='ORD-S34-C2B'`));
  const r = await call('POST', `orders/${oid}/handle`, A, { handleType: 'CANCEL' });
  const bExpired = scalar(`SELECT expireAt < UTC_TIMESTAMP() FROM point_transactions WHERE id=${B}`);
  ok('用例2b', 'B.remaining 恢复 40（但 expireAt 仍过期）', remain(B) === 40 && bExpired === '1', `B.remain=${remain(B)} expired=${bExpired}`);
}

// ---------------------------------------------------------------- 用例 3：异常订单审计（谁标记/谁处理/结果/时间）
{
  resetUser(3004);
  const E = 90030;
  seedEarn(3004, 53004, [{ txnId: E, points: 50, remaining: 50, expireSql: FUTURE }], 50, 50);
  sql(`INSERT INTO orders (orderNo, userId, merchantId, storeId, orderType, totalAmount, discountAmount, payAmount, pointsEarned, status, source, consumeTime, createdAt, updatedAt) VALUES ('ORD-S34-C3', 3004, 1, NULL, 'CONSUME', 100, 0, 100, 50, 'NORMAL', 'IMPORT', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP());`);
  const oid = Number(scalar(`SELECT id FROM orders WHERE orderNo='ORD-S34-C3'`));
  await call('PATCH', `orders/${oid}/abnormal`, A, { abnormalType: 'AMOUNT_ERROR', abnormalRemark: '金额录错多送分' });
  const handled = await call('POST', `orders/${oid}/handle`, A, { handleType: 'AMOUNT_ERROR', result: '已冲正 50 分' });
  const audit = scalar(`SELECT COUNT(*) FROM audit_logs WHERE module='order' AND action IN ('ORDER_MARK_ABNORMAL','ORDER_HANDLE') AND targetId=${oid}`);
  const orderState = scalar(`SELECT CONCAT(status,'|',IFNULL(handleResult,'NULL'),'|',IFNULL(handledBy,'NULL'),'|',IFNULL(handledAt,'NULL')) FROM orders WHERE id=${oid}`);
  ok('用例3', '标记 + 处理都有审计（2 条）', audit === '2', `audit=${audit}`);
  ok('用例3', '处理人/结果/时间落库（handled 而非删除）', orderState.startsWith('NORMAL|已冲正 50 分|1|'), `order=${orderState}`);
  ok('用例3', '异常订单未删除（仍在库）', scalar(`SELECT COUNT(*) FROM orders WHERE id=${oid}`) === '1', 'order exists');
}

// ---------------------------------------------------------------- 用例 4：并发处理同一异常订单
{
  resetUser(3005);
  const E = 90040;
  seedEarn(3005, 53005, [{ txnId: E, points: 50, remaining: 50, expireSql: FUTURE }], 50, 50);
  seedOrderWithCoupon('ORD-S34-C4', 3005, 53005, 1, 7005, 1002, 50, [{ amount: 50, sourceTxnId: E }], 'ABNORMAL');
  const oid = Number(scalar(`SELECT id FROM orders WHERE orderNo='ORD-S34-C4'`));
  const [ra, rb] = await Promise.all([
    call('POST', `orders/${oid}/handle`, A, { handleType: 'CANCEL' }),
    call('POST', `orders/${oid}/handle`, P, { handleType: 'CANCEL' }),
  ]);
  const statuses = [ra.status, rb.status].sort().join(',');
  const one409 = (ra.status === 409) !== (rb.status === 409);
  ok('用例4', '并发处理只有 1 个成功，另 1 个 409 ORDER_ALREADY_HANDLED', one409 && (ra.reason === 'ORDER_ALREADY_HANDLED' || rb.reason === 'ORDER_ALREADY_HANDLED'), `a=${ra.status}/${ra.reason} b=${rb.status}/${rb.reason}`);
}

// ---------------------------------------------------------------- 用例 5：权限隔离（附属只能标记，处理归主体）
{
  // 5a：附属标记别家订单 → 403 STORE_NOT_OWNED（标记有 scope 校验）
  resetUser(3006);
  const E = 90050;
  seedEarn(3006, 53006, [{ txnId: E, points: 50, remaining: 50, expireSql: FUTURE }], 50, 50);
  sql(`INSERT INTO orders (orderNo, userId, merchantId, storeId, orderType, totalAmount, discountAmount, payAmount, pointsEarned, status, source, consumeTime, createdAt, updatedAt) VALUES ('ORD-S34-C5', 3006, 3, NULL, 'CONSUME', 100, 0, 100, 50, 'NORMAL', 'IMPORT', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP());`);
  const oid5 = Number(scalar(`SELECT id FROM orders WHERE orderNo='ORD-S34-C5'`));
  const rMarkOther = await call('PATCH', `orders/${oid5}/abnormal`, S1, { abnormalType: 'STORE_DISPUTE', abnormalRemark: '跨店争议' });
  ok('用例5', '附属标记别家订单 → 403 STORE_NOT_OWNED', rMarkOther.status === 403 && rMarkOther.reason === 'STORE_NOT_OWNED', `status=${rMarkOther.status} reason=${rMarkOther.reason}`);

  // 5b：附属处理「本店 25 小时前」的异常订单 → 403（处理权归主体）
  resetUser(3008);
  const E2 = 90051;
  seedEarn(3008, 53008, [{ txnId: E2, points: 50, remaining: 50, expireSql: FUTURE }], 50, 50);
  sql(`INSERT INTO orders (orderNo, userId, merchantId, storeId, orderType, totalAmount, discountAmount, payAmount, pointsEarned, status, abnormalType, abnormalRemark, source, consumeTime, createdAt, updatedAt) VALUES ('ORD-S34-C5B', 3008, 2, 101, 'CONSUME', 100, 0, 100, 50, 'ABNORMAL', 'STORE_DISPUTE', '本店25小时前异常', 'APPLET', UTC_TIMESTAMP() - INTERVAL 25 HOUR, UTC_TIMESTAMP() - INTERVAL 25 HOUR, UTC_TIMESTAMP());`);
  const oid5b = Number(scalar(`SELECT id FROM orders WHERE orderNo='ORD-S34-C5B'`));
  const rSubHandle = await call('POST', `orders/${oid5b}/handle`, S1, { handleType: 'CANCEL' }); // sub01 (merchant 2) 处理本店订单
  ok('用例5', '附属处理本店 25 小时前异常 → 403（处理权归主体）', rSubHandle.status === 403, `status=${rSubHandle.status} reason=${rSubHandle.reason}`);
  const rMainHandle = await call('POST', `orders/${oid5b}/handle`, A, { handleType: 'CANCEL' });
  ok('用例5', '主体处理全平台订单成功', rMainHandle.status === 201, `status=${rMainHandle.status}`);
}

// ---------------------------------------------------------------- 补录订单（POST /orders + 送积分）
{
  resetUser(3007);
  sql(`INSERT INTO users (id, phone, nickname, status, registeredAt, createdAt, updatedAt) VALUES (3007,'133007','S34-3007','ACTIVE',UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE nickname='S34-3007';`);
  const r = await call('POST', 'orders', A, { orderNo: 'ORD-S34-CREATE', userId: 3007, merchantId: 1, totalAmount: 200, amount: 200, remark: '补录' });
  const okCreate = r.status === 201;
  const earnTxn = Number(scalar(`SELECT COUNT(*) FROM point_transactions WHERE userId=3007 AND type='EARN' AND relatedOrderId IS NOT NULL`));
  ok('补录', '补录订单 + 送积分（EARN 流水带 relatedOrderId）', okCreate && earnTxn >= 1, `status=${r.status} earn=${earnTxn}`);
}

log(`\n===== S3.4 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail === 0 ? 0 : 1);
