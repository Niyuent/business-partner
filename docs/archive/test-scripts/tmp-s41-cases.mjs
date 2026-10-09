/**
 * S4.1 验收用例：采购记录（purchase_no 格式 / 隔离 / 结算 / 不可删除）
 * 全部走真实 HTTP（http://localhost/api/v1）。
 */
const BASE = 'http://localhost/api/v1';
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

const A = await login('admin');
const S1 = await login('sub01');
const S2 = await login('sub02');

const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');

// 清空采购表（不可删除，但测试环境重建）
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT_PWD = readFileSync('.env', 'utf8').match(/^MYSQL_ROOT_PASSWORD=(.+)$/m)[1].trim();
function sql(statement) {
  writeFileSync('tmp-s41.sql', statement + '\n');
  execSync('docker compose cp tmp-s41.sql mysql:/tmp/s41x.sql', { stdio: 'pipe' });
  execSync(`docker compose exec -T mysql bash -c "mysql --default-character-set=utf8mb4 -uroot -p'${ROOT_PWD}' shangmeng < /tmp/s41x.sql"`, { stdio: 'pipe' });
}
function query(statement) {
  writeFileSync('tmp-s41.sql', statement + '\n');
  execSync('docker compose cp tmp-s41.sql mysql:/tmp/s41q.sql', { stdio: 'pipe' });
  return execSync(`docker compose exec -T mysql bash -c "mysql --default-character-set=utf8mb4 -uroot -p'${ROOT_PWD}' -N -B shangmeng < /tmp/s41q.sql"`, { encoding: 'utf8' }).trim();
}
const scalar = (stmt) => query(stmt).split('\n')[0]?.trim() ?? '';
sql('DELETE FROM purchase_records;');

// ---------------------------------------------------------------- 用例 1：新增采购 + purchaseNo 格式
{
  const r1 = await call('POST', 'purchases', A, { subMerchantId: 2, templateId: 1002, quantity: 10, unitPrice: 5 });
  const no1 = r1.data?.purchaseNo;
  ok('用例1', '新增成功，totalAmount = 50', r1.status === 201 && Number(r1.data?.totalAmount) === 50, `status=${r1.status} total=${r1.data?.totalAmount}`);
  ok('用例1', 'purchaseNo 格式 {main}-{sub}-{yyyymmdd}-{seq}', no1 === `1-2-${ymd}-1`, `purchaseNo=${no1}`);

  const r2 = await call('POST', 'purchases', A, { subMerchantId: 2, templateId: 1002, quantity: 1, unitPrice: 5 });
  ok('用例1', '同 main-sub 同天 seq 递增（-2）', r2.data?.purchaseNo === `1-2-${ymd}-2`, `purchaseNo=${r2.data?.purchaseNo}`);

  const r3 = await call('POST', 'purchases', A, { subMerchantId: 3, templateId: 1002, quantity: 2, unitPrice: 5 });
  ok('用例1', '不同 sub 独立编号（1-3-...-1）', r3.data?.purchaseNo === `1-3-${ymd}-1`, `purchaseNo=${r3.data?.purchaseNo}`);
}

// ---------------------------------------------------------------- 用例 2：隔离（主体全量 / 附属只看自己作为 sub）
{
  const rSub = await call('GET', 'purchases?page=1&pageSize=50', S1);
  const subIds = (rSub.data?.list ?? []).map((x) => x.subMerchantId);
  const allSub2 = subIds.every((x) => x === 2) && subIds.length === 2;
  ok('用例2', '附属只看到自己作为 sub 的（2 条，subMerchantId 全为 2）', rSub.status === 200 && allSub2, `list=${JSON.stringify(subIds)}`);

  const rMain = await call('GET', 'purchases?page=1&pageSize=50', A);
  ok('用例2', '主体看到全部（3 条）', rMain.data?.total === 3, `total=${rMain.data?.total}`);
}

// ---------------------------------------------------------------- 用例 3：附属 query 查别家 → 403
{
  const r = await call('GET', 'purchases?subMerchantId=3', S1);
  ok('用例3', '附属 query 查别家 → 403 FORBIDDEN_SCOPE', r.status === 403 && r.reason === 'FORBIDDEN_SCOPE', `status=${r.status} reason=${r.reason}`);
}

// ---------------------------------------------------------------- 用例 4：结算（UNSETTLED → SETTLED，不可回退）
{
  const rList = await call('GET', 'purchases?page=1&pageSize=50', A);
  const pid = rList.data.list.find((x) => x.purchaseNo === `1-2-${ymd}-1`).id;
  const r1 = await call('PATCH', `purchases/${pid}/settle`, A, { settleRemark: '已打款' });
  ok('用例4', '主体结算成功（SETTLED）', r1.status === 200 && r1.data?.settleStatus === 'SETTLED', `status=${r1.status} settle=${r1.data?.settleStatus}`);
  const r2 = await call('PATCH', `purchases/${pid}/settle`, A, {});
  ok('用例4', '重复结算 → 409（不可回退）', r2.status === 409, `status=${r2.status} reason=${r2.reason}`);
  const rSubSettle = await call('PATCH', `purchases/${pid}/settle`, S1, {});
  ok('用例4', '附属结算 → 403（结算权归主体）', rSubSettle.status === 403, `status=${rSubSettle.status} reason=${rSubSettle.reason}`);
}

// ---------------------------------------------------------------- 用例 5：不可删除（无 DELETE 端点）
{
  const r = await call('DELETE', 'purchases/1', A);
  ok('用例5', '无 DELETE 端点（404/405，采购不可删除）', r.status === 404 || r.status === 405, `status=${r.status}`);
}

// ---------------------------------------------------------------- 用例 6：purchaseNo 并发生成（seq 不撞号、无 500）
{
  // 5 个并发新增同一 main-sub 当天的采购
  const results = await Promise.all(
    Array.from({ length: 5 }, () => call('POST', 'purchases', A, { subMerchantId: 2, templateId: 1002, quantity: 1, unitPrice: 1 })),
  );
  const okCount = results.filter((r) => r.status === 201).length;
  const nos = results.filter((r) => r.status === 201).map((r) => r.data.purchaseNo);
  const distinct = new Set(nos).size === nos.length;
  ok('用例6', '5 并发新增全部成功（无 500）', okCount === 5, `成功 ${okCount}/5`);
  ok('用例6', 'purchaseNo 互不重复', distinct && nos.length === 5, `nos=${JSON.stringify(nos)}`);
}

// ---------------------------------------------------------------- 用例 7：settle 写 audit_logs（追问2）
{
  const rList = await call('GET', 'purchases?page=1&pageSize=50', A);
  const unsettled = rList.data.list.find((x) => x.settleStatus === 'UNSETTLED');
  const r = await call('PATCH', `purchases/${unsettled.id}/settle`, A, { settleRemark: '追问2-审计验证' });
  const auditCnt = Number(scalar(`SELECT COUNT(*) FROM audit_logs WHERE module='purchase' AND action='PURCHASE_SETTLE' AND targetId=${unsettled.id}`));
  ok('用例7', 'settle 写 audit_logs（PURCHASE_SETTLE）', r.status === 200 && auditCnt >= 1, `settle=${r.status} audit=${auditCnt}`);
}

// ---------------------------------------------------------------- 用例 8：主体视角 = B（自己作为 main 或 sub 的），附属越权别家 → 403（追问3）
{
  // sub02（merchant 3）只看到自己作为 sub 的（sub=3）
  const rSub2 = await call('GET', 'purchases?page=1&pageSize=50', S2);
  const subIds = (rSub2.data?.list ?? []).map((x) => x.subMerchantId);
  ok('用例8', '附属(sub02)只看到自己作为 sub 的（subMerchantId 全为 3）', rSub2.status === 200 && subIds.every((x) => x === 3) && subIds.length >= 1, `list=${JSON.stringify(subIds)}`);
  // sub02 试图 query 查 sub01（merchant 2）的采购 → 403
  const rCross = await call('GET', 'purchases?subMerchantId=2', S2);
  ok('用例8', '附属查别家(merchant 2) → 403 FORBIDDEN_SCOPE', rCross.status === 403 && rCross.reason === 'FORBIDDEN_SCOPE', `status=${rCross.status} reason=${rCross.reason}`);
}

log(`\n===== S4.1 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail === 0 ? 0 : 1);
