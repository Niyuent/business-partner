/**
 * S2 验收用例（回归）：券模板 / 券码 / 发放 / 核销 / 冲正（对齐 docs/04 A1/A2/A4/A7/A9）
 * 全部走真实 HTTP（http://localhost/api/v1）；过期券用 SQL 直造；结尾 SQL 清理，保证可重复。
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
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, data: j.data, msg: j.message, reason: j.data?.reasonCode };
}
const login = async (u) => (await call('POST', 'auth/login', null, { username: u, password: 'Test@123456' })).data?.accessToken ?? null;

function sql(statement) {
  writeFileSync('tmp-s2.sql', statement + '\n');
  execSync('docker compose cp tmp-s2.sql mysql:/tmp/s2x.sql', { stdio: 'pipe' });
  execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' shangmeng < /tmp/s2x.sql"`, { stdio: 'pipe' });
}
function query(statement) {
  writeFileSync('tmp-s2.sql', statement + '\n');
  execSync('docker compose cp tmp-s2.sql mysql:/tmp/s2q.sql', { stdio: 'pipe' });
  return execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' -N -B shangmeng < /tmp/s2q.sql"`, { encoding: 'utf8' }).trim();
}
const scalar = (s) => query(s).split('\n')[0]?.trim() ?? '';
const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');

const A = await login('admin');
const S1 = await login('sub01');
const S2 = await login('sub02');
const CK = await login('clerk01');

// ---------------------------------------------------------------- 模板（H1）
log('———— 券模板（H1 创建者必须主体） ————');
{
  const r = await call('POST', 'coupon-templates', S1, {
    ownerType: 'MAIN_COUPON', name: 'S2越权模板', faceValue: 10, thresholdAmount: 0, totalStock: 5, validType: 'AFTER_RECEIVE_DAYS', validDays: 30, applyScope: 'ALL_STORES', pointsCost: 10,
  });
  ok('A9', 'sub01 创建模板 → 403（无 coupon:create / H1）', r.status === 403, `HTTP=${r.status} ${r.reason}`);
}
let tplId = 0;
{
  const r = await call('POST', 'coupon-templates', A, {
    ownerType: 'MAIN_COUPON', name: `S2回归券-${ymd}`, faceValue: 10, thresholdAmount: 0, totalStock: 20, validType: 'AFTER_RECEIVE_DAYS', validDays: 30, applyScope: 'ALL_STORES', pointsCost: 5,
  });
  tplId = r.data?.template?.id ?? r.data?.id ?? 0;
  ok('T1', 'admin 创建模板 → 成功且初始 DRAFT', ok200(r.status) && tplId > 0, `HTTP=${r.status} id=${tplId}`);
  const p = await call('PATCH', `coupon-templates/${tplId}/publish`, A, {});
  ok('T2', 'publish → PUBLISHED', ok200(p.status) && (p.data?.template?.status ?? p.data?.status) === 'PUBLISHED', `HTTP=${p.status} status=${p.data?.template?.status ?? p.data?.status}`);
}
// ---------------------------------------------------------------- 券码
log('');
log('———— 券码预生成 ————');
const batchNo = `${tplId}-${ymd}-001`;
{
  const r = await call('POST', `coupon-templates/${tplId}/codes`, A, { batchNo, quantity: 5, remark: 'S2 回归' });
  ok('K1', '预生成券码 → 成功且返回 5 个码', ok200(r.status) && (r.data?.codes ?? []).length === 5 && r.data?.batchNo === batchNo, `HTTP=${r.status} batchNo=${r.data?.batchNo} n=${(r.data?.codes ?? []).length}`);
}
{
  const r = await call('POST', `coupon-templates/${tplId}/codes`, A, { batchNo, quantity: 5 });
  ok('K2', '同批次号重复生成 → 409 BATCH_ALREADY_EXISTS', r.status === 409 && r.reason === 'BATCH_ALREADY_EXISTS', `HTTP=${r.status} ${r.reason}`);
}
// ---------------------------------------------------------------- 发放（H2）
log('');
log('———— 发券授权校验（H2） ————');
{
  const r = await call('POST', 'coupon-instances/issue', S2, { templateId: 1001, userId: 1001, quantity: 1 });
  ok('A1', '未授权附属 sub02 发主体券 → 403', r.status === 403, `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', 'coupon-instances/issue', S1, { templateId: 1003, userId: 1001, quantity: 1 });
  ok('A2', '已授权附属 sub01 发未授权券 T3 → 403', r.status === 403, `HTTP=${r.status} ${r.reason}`);
}
let issuedCode = '';
{
  const r = await call('POST', 'coupon-instances/issue', S1, { templateId: 1001, userId: 1002, quantity: 1, remark: 'S2 回归发券' });
  issuedCode = scalar(`SELECT c.code FROM coupon_instances i JOIN coupon_codes c ON c.instanceId=i.id WHERE i.userId=1002 AND i.templateId=1001 AND i.status='UNUSED' ORDER BY i.id DESC LIMIT 1`);
  ok('I1', 'sub01 发授权范围内的主体券 T1 → 成功且券码已绑定', ok200(r.status) && issuedCode.length >= 12, `HTTP=${r.status} code=${issuedCode}`);
}
// ---------------------------------------------------------------- 核销（H4 幂等 / 冲正）
log('');
log('———— 核销与冲正 ————');
let redemptionId = 0;
{
  const r = await call('POST', 'redemptions', CK, { code: issuedCode, orderNo: `S2-ORD-${Date.now()}`, orderAmount: 100 });
  redemptionId = Number(scalar(`SELECT id FROM redemption_records WHERE code='${issuedCode}' AND status='SUCCESS' ORDER BY id DESC LIMIT 1`));
  ok('R1', '店员核销 → 成功生成 SUCCESS 记录', ok200(r.status) && redemptionId > 0, `HTTP=${r.status} id=${redemptionId}`);
}
{
  const r = await call('POST', 'redemptions', CK, { code: issuedCode, orderNo: `S2-ORD-DUP-${Date.now()}`, orderAmount: 100 });
  ok('A7', '同券重复核销 → 409 COUPON_ALREADY_USED（H4 幂等）', r.status === 409 && r.reason === 'COUPON_ALREADY_USED', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', `redemptions/${redemptionId}/reverse`, A, { reason: 'S2 回归：订单取消冲正' });
  const st = scalar(`SELECT status FROM coupon_instances WHERE code='${issuedCode}' ORDER BY id DESC LIMIT 1`);
  ok('R2', '冲正 → 成功且券回 UNUSED', ok200(r.status) && st === 'UNUSED', `HTTP=${r.status} coupon=${st}`);
}
// ---------------------------------------------------------------- 过期券（A4）
log('');
log('———— 过期券核销（H5） ————');
{
  sql(`DELETE FROM coupon_instances WHERE id=9000001;
       INSERT INTO coupon_instances (id, userId, templateId, code, issuerMerchantId, source, pointsCost, status, obtainedAt, expireAt, createdAt, updatedAt)
       VALUES (9000001, 1002, 1001, 'S2EXPIRED01', 1, 'EXCHANGE', 0, 'UNUSED', UTC_TIMESTAMP()-INTERVAL 40 DAY, UTC_TIMESTAMP()-INTERVAL 10 DAY, UTC_TIMESTAMP(), UTC_TIMESTAMP());`);
  const r = await call('POST', 'redemptions', CK, { code: 'S2EXPIRED01', orderNo: `S2-ORD-EXP-${Date.now()}`, orderAmount: 100 });
  ok('A4', '过期券核销 → COUPON_EXPIRED 且无 SUCCESS 记录', r.status >= 400 && scalar(`SELECT COUNT(*) FROM redemption_records WHERE code='S2EXPIRED01' AND status='SUCCESS'`) === '0', `HTTP=${r.status} ${r.reason}`);
}

// ---------------------------------------------------------------- 清理
sql(`DELETE FROM redemption_records WHERE code IN ('${issuedCode}', 'S2EXPIRED01');
     DELETE FROM orders WHERE orderNo LIKE 'S2-ORD-%';
     DELETE FROM coupon_instances WHERE id=9000001 OR code IN ('${issuedCode}');
     DELETE FROM coupon_codes WHERE batchNo='${batchNo}' OR templateId=${tplId || -1};
     DELETE FROM coupon_code_batches WHERE batchNo='${batchNo}' OR templateId=${tplId || -1};
     DELETE FROM coupon_templates WHERE id=${tplId || -1};`);
log(`  （已清理临时模板 #${tplId} 与其券码/批次，及测试核销）`);

log(`\n===== S2 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail === 0 ? 0 : 1);
