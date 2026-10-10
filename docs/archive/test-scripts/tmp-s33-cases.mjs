/**
 * S3.3 验收用例：积分过期清零（定时任务 / 手动触发）
 * 全部走真实 HTTP（http://localhost/api/v1），EARN 批次用 SQL 直插（可控 expireAt）。
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
  writeFileSync('tmp-s33.sql', statement + '\n');
  execSync('docker compose cp tmp-s33.sql mysql:/tmp/s33x.sql', { stdio: 'pipe' });
  execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' shangmeng < /tmp/s33x.sql"`, { stdio: 'pipe' });
}
function query(statement) {
  writeFileSync('tmp-s33.sql', statement + '\n');
  execSync('docker compose cp tmp-s33.sql mysql:/tmp/s33q.sql', { stdio: 'pipe' });
  const out = execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' -N -B shangmeng < /tmp/s33q.sql"`, { encoding: 'utf8' });
  return out.trim();
}
const scalar = (stmt) => query(stmt).split('\n')[0]?.trim() ?? '';

const A = await login('admin');

// 前置：先触发一次过期任务，清空「非本用例」的历史过期批次（如 seed 给张三(1001) 预置的过期批次），
// 使后续「全局 processed / expiredAmount 计数」断言与脚本执行顺序无关（S5 起点任务：S3.3 独立化）。
const normalize = await call('POST', 'tasks/points/expire', A, {});
log(`（前置归一：清空历史过期批次 processed=${normalize.data?.processed ?? '-'}）`);
log('');

const PAST = "UTC_TIMESTAMP() - INTERVAL 1 DAY";
const FUTURE = "UTC_TIMESTAMP() + INTERVAL 1 DAY";
// S4 收口回归稳健性：原用 +1s 作「未来批次」边界，在 Docker（cp/exec/HTTP 延迟）下会抖动
// （延迟 >1s 就把未来批次算成已过期）。放宽到 +30s，语义仍是「未来批次不被处理」，但确定性强。
const PLUS_FUTURE = "UTC_TIMESTAMP() + INTERVAL 30 SECOND";
const MINUS_1S = "UTC_TIMESTAMP() - INTERVAL 1 SECOND";

/** 重置用户积分数据，并直插一个账户 + 若干 EARN 批次（accountId 固定为 userId+50000，避免撞自增） */
function seedEarn(userId, balance, batches) {
  const accountId = userId + 50000;
  sql(`INSERT INTO users (id, phone, nickname, status, registeredAt, createdAt, updatedAt) VALUES (${userId}, '13${userId}', 'S33-${userId}', 'ACTIVE', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE nickname='S33-${userId}'; DELETE FROM point_transactions WHERE userId = ${userId}; DELETE FROM point_accounts WHERE userId = ${userId};`);
  const rows = batches
    .map((b, i) => `(${userId}, ${accountId}, 'EARN', ${b.points}, ${b.points}, ${balance}, ${b.expireSql}, 1, NULL, NULL, 's33-${i}', UTC_TIMESTAMP())`)
    .join(',');
  sql(`
    INSERT INTO point_accounts (id, userId, balance, totalEarned, totalSpent, totalExpired, version, updatedAt)
    VALUES (${accountId}, ${userId}, ${balance}, ${balance}, 0, 0, 0, UTC_TIMESTAMP())
    ON DUPLICATE KEY UPDATE balance=${balance}, totalEarned=${balance}, totalSpent=0, totalExpired=0, version=0;
    INSERT INTO point_transactions (userId, accountId, type, amount, remainingAmount, balanceAfter, expireAt, merchantId, storeId, operatorId, remark, createdAt)
    VALUES ${rows};`);
}

const acct = (userId) => scalar(`SELECT CONCAT(balance, '|', totalExpired) FROM point_accounts WHERE userId=${userId}`);
const expireCnt = (userId) => Number(scalar(`SELECT COUNT(*) FROM point_transactions WHERE userId=${userId} AND type='EXPIRE'`));
const remain = (userId) => scalar(`SELECT GROUP_CONCAT(remainingAmount ORDER BY id) FROM point_transactions WHERE userId=${userId} AND type='EARN'`);

// ---------------------------------------------------------------- 用例 1：幂等（触发两次，第二次 0 笔）
{
  seedEarn(2001, 100, [{ points: 100, expireSql: PAST }]);
  const r1 = await call('POST', 'tasks/points/expire', A, {});
  const r2 = await call('POST', 'tasks/points/expire', A, {});
  ok('用例1', '第一次触发处理 1 笔、过期 100', r1.data?.processed === 1 && r1.data?.expiredAmount === 100, `processed=${r1.data?.processed} expired=${r1.data?.expiredAmount}`);
  ok('用例1', '第二次触发处理 0 笔（幂等）', r2.data?.processed === 0 && r2.data?.expiredAmount === 0, `processed=${r2.data?.processed} expired=${r2.data?.expiredAmount}`);
  ok('用例1', '账户清零 + totalExpired=100 + 仅 1 条 EXPIRE', acct(2001) === '0|100' && expireCnt(2001) === 1, `acct=${acct(2001)} expire=${expireCnt(2001)}`);
}

// ---------------------------------------------------------------- 用例 2：部分过期 A(100)+B(50) 同时到期
{
  seedEarn(2002, 150, [{ points: 100, expireSql: PAST }, { points: 50, expireSql: PAST }]);
  const r = await call('POST', 'tasks/points/expire', A, {});
  ok('用例2', '一次处理 2 笔、过期 150', r.data?.processed === 2 && r.data?.expiredAmount === 150, `processed=${r.data?.processed} expired=${r.data?.expiredAmount}`);
  ok('用例2', '余额 -150、生成 2 条 EXPIRE', acct(2002) === '0|150' && expireCnt(2002) === 2, `acct=${acct(2002)} expire=${expireCnt(2002)}`);
}

// ---------------------------------------------------------------- 用例 3：边界时间（未来 +30s 不处理 / 过去 -1s 处理）
{
  // 两条批次放同一 SQL 一次插入；未来批次用 +30s 留足余量（避免 Docker 延迟抖动）
  const mk = (userId, accountId, points, expireSql) =>
    `(${userId}, ${accountId}, 'EARN', ${points}, ${points}, ${points}, ${expireSql}, 1, NULL, NULL, 's33-b', UTC_TIMESTAMP())`;
  sql(`
    INSERT INTO users (id, phone, nickname, status, registeredAt, createdAt, updatedAt) VALUES
      (2003,'132003','S33-2003','ACTIVE',UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP()),
      (2004,'132004','S33-2004','ACTIVE',UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP())
    ON DUPLICATE KEY UPDATE nickname=VALUES(nickname);
    DELETE FROM point_transactions WHERE userId IN (2003,2004);
    DELETE FROM point_accounts WHERE userId IN (2003,2004);
    INSERT INTO point_accounts (id, userId, balance, totalEarned, totalSpent, totalExpired, version, updatedAt) VALUES
      (52003, 2003, 40, 40, 0, 0, 0, UTC_TIMESTAMP()),
      (52004, 2004, 60, 60, 0, 0, 0, UTC_TIMESTAMP());
    INSERT INTO point_transactions (userId, accountId, type, amount, remainingAmount, balanceAfter, expireAt, merchantId, storeId, operatorId, remark, createdAt) VALUES
      ${mk(2003, 52003, 40, PLUS_FUTURE)},
      ${mk(2004, 52004, 60, MINUS_1S)};
  `);
  const r = await call('POST', 'tasks/points/expire', A, {});
  ok('用例3', '只处理 -1s 的 1 笔、过期 60', r.data?.processed === 1 && r.data?.expiredAmount === 60, `processed=${r.data?.processed} expired=${r.data?.expiredAmount}`);
  ok('用例3', '+30s（未来）批次未动（remaining=40）', remain(2003) === '40', `remain(2003)=${remain(2003)}`);
  ok('用例3', '-1s 批次已清零（balance=0）', acct(2004) === '0|60', `acct(2004)=${acct(2004)}`);
  // 清掉边界用户，避免 +1s 批次在后续用例的全局扫描里被误当成过期
  sql('DELETE FROM point_transactions WHERE userId IN (2003,2004); DELETE FROM point_accounts WHERE userId IN (2003,2004);');
}

// ---------------------------------------------------------------- 用例 4：混合状态（同一用户 1 过期 + 1 未过期）
{
  seedEarn(2005, 70, [{ points: 30, expireSql: PAST }, { points: 40, expireSql: FUTURE }]);
  const r = await call('POST', 'tasks/points/expire', A, {});
  ok('用例4', '只处理过期批次（1 笔 / 30 分）', r.data?.processed === 1 && r.data?.expiredAmount === 30, `processed=${r.data?.processed} expired=${r.data?.expiredAmount}`);
  ok('用例4', '余额剩 40、未过期批次不动', acct(2005) === '40|30' && remain(2005) === '0,40', `acct=${acct(2005)} remain=${remain(2005)}`);
}

// ---------------------------------------------------------------- 用例 5：并发触发（只有一个处理，无重复 EXPIRE）
{
  seedEarn(2006, 90, [{ points: 90, expireSql: PAST }]);
  const [ra, rb] = await Promise.all([
    call('POST', 'tasks/points/expire', A, {}),
    call('POST', 'tasks/points/expire', A, {}),
  ]);
  const total = (ra.data?.processed ?? 0) + (rb.data?.processed ?? 0);
  const skipped = (ra.data?.skipped || rb.data?.skipped) ? true : false;
  ok('用例5', '并发触发只有 1 个实际处理（另一个跳过或 0 笔）', (ra.data?.skipped === true || rb.data?.skipped === true || ra.data?.processed === 0 || rb.data?.processed === 0) && total <= 1, `a={processed:${ra.data?.processed},skipped:${ra.data?.skipped}} b={processed:${rb.data?.processed},skipped:${rb.data?.skipped}}`);
  ok('用例5', '无重复 EXPIRE、余额扣一次', expireCnt(2006) === 1 && acct(2006) === '0|90', `expire=${expireCnt(2006)} acct=${acct(2006)}`);
}

// ---------------------------------------------------------------- 用例 6：性能（10000 条过期批次 < 30s）
{
  const userId = 2007;
  const accountId = userId + 50000;
  sql(`INSERT INTO users (id, phone, nickname, status, registeredAt, createdAt, updatedAt) VALUES (${userId}, '13${userId}', 'S33-${userId}', 'ACTIVE', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE nickname='S33-${userId}'; DELETE FROM point_transactions WHERE userId = ${userId}; DELETE FROM point_accounts WHERE userId = ${userId}; INSERT INTO point_accounts (id, userId, balance, totalEarned, totalSpent, totalExpired, version, updatedAt) VALUES (${accountId}, ${userId}, 10000, 10000, 0, 0, 0, UTC_TIMESTAMP());`);
  const CHUNK = 5000;
  let tuples = [];
  for (let i = 0; i < 10000; i++) {
    tuples.push(`(${userId}, ${accountId}, 'EARN', 1, 1, 10000, ${PAST}, 1, NULL, NULL, 'perf-${i}', UTC_TIMESTAMP())`);
    if (tuples.length === CHUNK) {
      sql(`INSERT INTO point_transactions (userId, accountId, type, amount, remainingAmount, balanceAfter, expireAt, merchantId, storeId, operatorId, remark, createdAt) VALUES ${tuples.join(',')};`);
      tuples = [];
    }
  }
  if (tuples.length) sql(`INSERT INTO point_transactions (userId, accountId, type, amount, remainingAmount, balanceAfter, expireAt, merchantId, storeId, operatorId, remark, createdAt) VALUES ${tuples.join(',')};`);

  const t0 = Date.now();
  const r = await call('POST', 'tasks/points/expire', A, {});
  const ms = Date.now() - t0;
  ok('用例6', '10000 条全部处理', r.data?.processed === 10000 && r.data?.expiredAmount === 10000, `processed=${r.data?.processed} expired=${r.data?.expiredAmount}`);
  ok('用例6', `耗时 < 30 秒（实际 ${(ms / 1000).toFixed(2)}s）`, ms < 30000, `${ms} ms`);
}

// ---------------------------------------------------------------- 审计日志
{
  const cnt = Number(scalar(`SELECT COUNT(*) FROM audit_logs WHERE module='point' AND action='POINTS_EXPIRE'`));
  ok('审计', '过期任务写审计日志（POINTS_EXPIRE）', cnt >= 6, `audit rows=${cnt}`);
}

log(`\n===== S3.3 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail === 0 ? 0 : 1);
