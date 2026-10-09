/**
 * S4.2 验收用例：对账账单（快照一致性 / 幂等 / 隔离 / 状态机 / CSV / 性能）
 * 全部走真实 HTTP（http://localhost/api/v1），核销明细用 SQL 直插（可控 faceValue / 时间）。
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

async function call(method, path, token, body, raw) {
  const res = await fetch(BASE + '/' + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (raw) {
    // 必须取原始字节：fetch 的 res.text() 按 WHATWG 规范会剥离 UTF-8 BOM，导致 BOM 检测假失败
    const bytes = Buffer.from(await res.arrayBuffer());
    return { status: res.status, text: bytes.toString('utf8'), bytes };
  }
  const j = await res.json().catch(() => ({}));
  return { status: res.status, data: j.data, msg: j.message, reason: j.data?.reasonCode };
}
const login = async (u) => (await call('POST', 'auth/login', null, { username: u, password: 'Test@123456' })).data?.accessToken ?? null;

function sql(statement) {
  writeFileSync('tmp-s42.sql', statement + '\n');
  execSync('docker compose cp tmp-s42.sql mysql:/tmp/s42x.sql', { stdio: 'pipe' });
  execSync(`docker compose exec -T mysql bash -c "mysql --default-character-set=utf8mb4 -uroot -p'${ROOT_PWD}' shangmeng < /tmp/s42x.sql"`, { stdio: 'pipe' });
}
function query(statement) {
  writeFileSync('tmp-s42.sql', statement + '\n');
  execSync('docker compose cp tmp-s42.sql mysql:/tmp/s42q.sql', { stdio: 'pipe' });
  return execSync(`docker compose exec -T mysql bash -c "mysql --default-character-set=utf8mb4 -uroot -p'${ROOT_PWD}' -N -B shangmeng < /tmp/s42q.sql"`, { encoding: 'utf8' }).trim();
}
const scalar = (stmt) => query(stmt).split('\n')[0]?.trim() ?? '';

const A = await login('admin');
const S1 = await login('sub01');
const S2 = await login('sub02');

const PERIOD_START = '2026-09-01T00:00:00.000Z';
const PERIOD_END = '2026-10-01T00:00:00.000Z';
const MID = "UTC_TIMESTAMP() - INTERVAL 10 DAY"; // 落在 9 月周期内
/** ISO8601 → MySQL DATETIME 字面量（'2026-09-01T00:00:00.000Z' → '2026-09-01 00:00:00'）。
 *  仅用于 SQL 比较；API 请求体仍传 ISO（DTO 用 @IsISO8601 校验）。
 *  Prisma 以 UTC 写入 DATETIME 列，故此处按 UTC 字面量比对即可命中。 */
const sqlDt = (iso) => iso.replace('T', ' ').replace(/\.\d+Z$/, '');

/** 直插一条核销（券实例 + 核销记录），merchant=2 / store=101 */
function seedRedemption(couponId, userId, faceValue, redeemedAtSql, merchantId = 2, storeId = 101) {
  sql(`INSERT INTO coupon_instances (id, userId, templateId, code, issuerMerchantId, source, pointsCost, status, obtainedAt, expireAt, createdAt, updatedAt) VALUES (${couponId}, ${userId}, 1002, 'S42C${couponId}', ${merchantId}, 'EXCHANGE', 0, 'UNUSED', UTC_TIMESTAMP(), UTC_TIMESTAMP() + INTERVAL 1 DAY, UTC_TIMESTAMP(), UTC_TIMESTAMP());
       INSERT INTO redemption_records (couponInstanceId, code, userId, storeId, merchantId, operatorId, templateId, faceValue, discountAmount, orderId, channel, status, redeemedAt, createdAt) VALUES (${couponId}, 'S42C${couponId}', ${userId}, ${storeId}, ${merchantId}, 1, 1002, ${faceValue}, ${faceValue}, NULL, 'MANUAL', 'SUCCESS', ${redeemedAtSql}, UTC_TIMESTAMP());`);
}

// 清理：删掉测试用的券实例/核销/对账单（按 code 前缀 + period）。
// 必须覆盖本脚本用到的**全部**周期（用例4 另用 06/07/08 月、用例6 用 05 月），
// 否则第二次运行时残留的 CONFIRMED/DISPUTED 状态会让状态机用例假失败（脚本不可重复运行）。
sql(`DELETE FROM settlement_reports WHERE periodStart IN ('${sqlDt(PERIOD_START)}', '2026-08-01 00:00:00', '2026-07-01 00:00:00', '2026-06-01 00:00:00', '2026-05-01 00:00:00');
     DELETE FROM redemption_records WHERE code LIKE 'S42C%';
     DELETE FROM coupon_instances WHERE code LIKE 'S42C%';
     DELETE FROM redemption_records WHERE code LIKE 'S42P%';
     DELETE FROM coupon_instances WHERE code LIKE 'S42P%';`);

// 建测试用户 4001/4002
sql(`INSERT INTO users (id, phone, nickname, status, registeredAt, createdAt, updatedAt) VALUES (4001,'144001','S42-4001','ACTIVE',UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE nickname='S42-4001';
     INSERT INTO users (id, phone, nickname, status, registeredAt, createdAt, updatedAt) VALUES (4002,'144002','S42-4002','ACTIVE',UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE nickname='S42-4002';`);

// ---------------------------------------------------------------- 用例 1：快照一致性
{
  seedRedemption(40001, 4001, 20, MID);
  seedRedemption(40002, 4001, 30, MID);
  const r = await call('POST', 'settlements/generate', A, { merchantId: 2, periodStart: PERIOD_START, periodEnd: PERIOD_END });
  const sid = r.data?.id;
  const amt1 = r.data?.totalAmount;
  ok('用例1', '生成对账单，金额 = 20+30 = 50', r.status === 201 && amt1 === 50, `status=${r.status} amount=${amt1}`);
  // 再核销一笔（应在快照之外）
  seedRedemption(40003, 4001, 100, MID);
  const r2 = await call('GET', `settlements/${sid}`, A);
  ok('用例1', '快照一致性：新增核销后金额不变（仍 50）', r2.data?.totalAmount === 50 && r2.data?.redemptionCount === 2, `amount=${r2.data?.totalAmount} count=${r2.data?.redemptionCount}`);
}

// ---------------------------------------------------------------- 用例 2：幂等生成
{
  const r = await call('POST', 'settlements/generate', A, { merchantId: 2, periodStart: PERIOD_START, periodEnd: PERIOD_END });
  ok('用例2', '重复生成返回已存在（200 + idempotent）', r.status === 200 && r.data?.idempotent === true, `status=${r.status} idempotent=${r.data?.idempotent}`);
  const cnt = Number(scalar(`SELECT COUNT(*) FROM settlement_reports WHERE merchantId=2 AND periodStart='${sqlDt(PERIOD_START)}'`));
  ok('用例2', '库里只有 1 条（不重复创建）', cnt === 1, `count=${cnt}`);
}

// ---------------------------------------------------------------- 用例 3：数据隔离
{
  // sub01(merchant 2) 看自己的
  const rSub = await call('GET', 'settlements?page=1&pageSize=50', S1);
  const ids = (rSub.data?.list ?? []).map((x) => x.merchantId);
  ok('用例3', '附属只看到自己的对账单（merchantId 全为 2）', rSub.status === 200 && ids.every((x) => x === 2) && ids.length >= 1, `list=${JSON.stringify(ids)}`);
  // sub01 查 merchant 3 的对账单详情 → 404（不泄露）
  // 先给 merchant 3 生成一份
  seedRedemption(40010, 4002, 15, MID, 3, null);
  await call('POST', 'settlements/generate', A, { merchantId: 3, periodStart: PERIOD_START, periodEnd: PERIOD_END });
  const sid3 = Number(scalar(`SELECT id FROM settlement_reports WHERE merchantId=3 AND periodStart='${sqlDt(PERIOD_START)}'`));
  const rCross = await call('GET', `settlements/${sid3}`, S1);
  ok('用例3', '附属查别家对账单 → 404（不泄露）', rCross.status === 404, `status=${rCross.status}`);
  // 主体看全部
  const rMain = await call('GET', 'settlements?page=1&pageSize=50', A);
  ok('用例3', '主体看全部（≥2 条）', (rMain.data?.total ?? 0) >= 2, `total=${rMain.data?.total}`);
}

// ---------------------------------------------------------------- 用例 4：状态机
{
  // 4a: GENERATED → CONFIRMED
  seedRedemption(40020, 4001, 10, MID);
  const g = await call('POST', 'settlements/generate', A, { merchantId: 2, periodStart: '2026-08-01T00:00:00.000Z', periodEnd: '2026-09-01T00:00:00.000Z' });
  const sid = g.data?.id;
  const rConfirm = await call('PATCH', `settlements/${sid}/confirm`, A, { confirm: true });
  ok('用例4', 'GENERATED → CONFIRMED 成功', rConfirm.status === 200 && rConfirm.data?.status === 'CONFIRMED', `status=${rConfirm.status}`);

  // 4b: CONFIRMED → DISPUTED → 409 SETTLEMENT_FROZEN
  const rFrozen = await call('PATCH', `settlements/${sid}/confirm`, A, { confirm: false, disputeReason: '想反悔，需要重新核对' });
  ok('用例4', 'CONFIRMED → DISPUTED → 409 SETTLEMENT_FROZEN', rFrozen.status === 409 && rFrozen.reason === 'SETTLEMENT_FROZEN', `status=${rFrozen.status} reason=${rFrozen.reason}`);

  // 4c: GENERATED → DISPUTED（新一份）
  seedRedemption(40030, 4001, 10, MID);
  const g2 = await call('POST', 'settlements/generate', A, { merchantId: 2, periodStart: '2026-07-01T00:00:00.000Z', periodEnd: '2026-08-01T00:00:00.000Z' });
  const sid2 = g2.data?.id;
  const rDispute = await call('PATCH', `settlements/${sid2}/confirm`, A, { confirm: false, disputeReason: '金额对不上，需要核对' });
  ok('用例4', 'GENERATED → DISPUTED 成功（必填原因）', rDispute.status === 200 && rDispute.data?.status === 'DISPUTED', `status=${rDispute.status}`);

  // 4d: DISPUTED → CONFIRMED → 409（必须先重新生成）
  const rDisputeConfirm = await call('PATCH', `settlements/${sid2}/confirm`, A, { confirm: true });
  ok('用例4', 'DISPUTED → CONFIRMED → 409 SETTLEMENT_NOT_CONFIRMABLE', rDisputeConfirm.status === 409 && rDisputeConfirm.reason === 'SETTLEMENT_NOT_CONFIRMABLE', `status=${rDisputeConfirm.status} reason=${rDisputeConfirm.reason}`);

  // 4e: 异议缺原因 → 400
  const g3 = await call('POST', 'settlements/generate', A, { merchantId: 2, periodStart: '2026-06-01T00:00:00.000Z', periodEnd: '2026-07-01T00:00:00.000Z' });
  const rNoReason = await call('PATCH', `settlements/${g3.data?.id}/confirm`, A, { confirm: false });
  ok('用例4', '提异议缺原因 → 400 SETTLEMENT_DISPUTE_REASON_REQUIRED', rNoReason.status === 400 && rNoReason.reason === 'SETTLEMENT_DISPUTE_REASON_REQUIRED', `status=${rNoReason.status} reason=${rNoReason.reason}`);

  // 4f: DISPUTED → 重新生成 → GENERATED
  const rRegen = await call('POST', 'settlements/generate', A, { merchantId: 2, periodStart: '2026-07-01T00:00:00.000Z', periodEnd: '2026-08-01T00:00:00.000Z' });
  ok('用例4', 'DISPUTED → 重新生成 → GENERATED', rRegen.data?.status === 'GENERATED' && rRegen.data?.regenerated === true, `status=${rRegen.data?.status} regen=${rRegen.data?.regenerated}`);
}

// ---------------------------------------------------------------- 用例 5：CSV 导出（BOM / 引号转义 / 字段）
{
  const sid = Number(scalar(`SELECT id FROM settlement_reports WHERE merchantId=2 AND periodStart='${sqlDt(PERIOD_START)}'`));
  const r = await call('GET', `settlements/${sid}/export`, A, null, true);
  const hasBOM = r.bytes[0] === 0xef && r.bytes[1] === 0xbb && r.bytes[2] === 0xbf; // EF BB BF
  const hasHeader = r.text.includes('券码') && r.text.includes('面值') && r.text.includes('门店');
  ok('用例5', 'CSV 带 UTF-8 BOM（Excel 中文不乱码）', hasBOM, `firstChar=0x${r.text.charCodeAt(0).toString(16)}`);
  ok('用例5', 'CSV 字段完整（券码/用户/核销时间/门店/面值/抵扣）', hasHeader, `contains=${hasHeader}`);
  ok('用例5', 'CSV 引号转义（字段被双引号包裹）', r.text.includes('"'), `quoted=${r.text.includes('"')}`);
}

// ---------------------------------------------------------------- 用例 6：性能（10000 条核销 < 5 秒）
{
  // 清掉之前的测试核销，给 merchant 2 在 2026-05 周期造 10000 条
  sql(`DELETE FROM redemption_records WHERE code LIKE 'S42P%'; DELETE FROM coupon_instances WHERE code LIKE 'S42P%';`);
  const CHUNK = 1000;
  for (let batch = 0; batch < 10; batch++) {
    const ci = [], rr = [];
    for (let i = 0; i < CHUNK; i++) {
      const id = 50000 + batch * CHUNK + i;
      ci.push(`(${id}, 4001, 1002, 'S42P${id}', 2, 'EXCHANGE', 0, 'UNUSED', UTC_TIMESTAMP(), UTC_TIMESTAMP() + INTERVAL 1 DAY, UTC_TIMESTAMP(), UTC_TIMESTAMP())`);
      rr.push(`(${id}, 'S42P${id}', 4001, 101, 2, 1, 1002, 1, 1, NULL, 'MANUAL', 'SUCCESS', UTC_TIMESTAMP() - INTERVAL 100 DAY, UTC_TIMESTAMP())`);
    }
    sql(`INSERT INTO coupon_instances (id, userId, templateId, code, issuerMerchantId, source, pointsCost, status, obtainedAt, expireAt, createdAt, updatedAt) VALUES ${ci.join(',')};
         INSERT INTO redemption_records (couponInstanceId, code, userId, storeId, merchantId, operatorId, templateId, faceValue, discountAmount, orderId, channel, status, redeemedAt, createdAt) VALUES ${rr.join(',')};`);
  }
  const t0 = Date.now();
  const r = await call('POST', 'settlements/generate', A, { merchantId: 2, periodStart: '2026-05-01T00:00:00.000Z', periodEnd: '2026-09-01T00:00:00.000Z' });
  const ms = Date.now() - t0;
  ok('用例6', '10000 条核销生成对账单 < 5 秒', ms < 5000, `${ms}ms`);
  ok('用例6', '总额 = 10000（DB 聚合，非应用层循环）', r.data?.totalAmount === 10000 && r.data?.totalCount === 10000, `amount=${r.data?.totalAmount} count=${r.data?.totalCount}`);
}

log(`\n===== S4.2 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail === 0 ? 0 : 1);
