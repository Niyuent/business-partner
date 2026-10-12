/**
 * S5.3 验收用例：门店变更申请（提交 → 审核 → 生效）
 * 真实 HTTP；结尾清理申请并还原 store 101 字段，保证可重复。
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost/api/v1';
const ROOT_PWD = readFileSync('.env', 'utf8').match(/^MYSQL_ROOT_PASSWORD=(.+)$/m)[1].trim();
const TAG = Date.now().toString().slice(-6);
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
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, data: j.data, msg: j.message, reason: j.data?.reasonCode };
}
const login = async (u) => (await call('POST', 'auth/login', null, { username: u, password: 'Test@123456' })).data?.accessToken ?? null;

function sql(statement) {
  writeFileSync('tmp-s53.sql', statement + '\n');
  execSync('docker compose cp tmp-s53.sql mysql:/tmp/s53x.sql', { stdio: 'pipe' });
  execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' shangmeng < /tmp/s53x.sql"`, { stdio: 'pipe' });
}
function scalar(s) {
  writeFileSync('tmp-s53.sql', s + '\n');
  execSync('docker compose cp tmp-s53.sql mysql:/tmp/s53q.sql', { stdio: 'pipe' });
  return execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' -N -B shangmeng < /tmp/s53q.sql"`, { encoding: 'utf8' }).trim().split('\n')[0]?.trim() ?? '';
}

const A = await login('admin');
const S1 = await login('sub01');
const CK = await login('clerk01');

const subMerchant = Number(scalar(`SELECT merchantId FROM admin_users WHERE username='sub01'`));
const ownStore = Number(scalar(`SELECT id FROM stores WHERE merchantId=${subMerchant} ORDER BY id LIMIT 1`));
const otherStore = Number(scalar(`SELECT id FROM stores WHERE merchantId<>${subMerchant} ORDER BY id LIMIT 1`));
log(`（sub01 商户=${subMerchant} 本店=${ownStore} 别家门店=${otherStore}）`);

// 中文一律经 HEX 读写：Windows 控制台会把非 ASCII 输出转成 '?'，直接回写会污染数据
const hexToStr = (h) => (h ? Buffer.from(h, 'hex').toString('utf8') : '');
const unhex = (h) => (h ? `UNHEX('${h}')` : 'NULL');
const origNameHex = scalar(`SELECT HEX(name) FROM stores WHERE id=${ownStore}`);
const origPhoneHex = scalar(`SELECT HEX(IFNULL(contactPhone,'')) FROM stores WHERE id=${ownStore}`);
const origHoursHex = scalar(`SELECT HEX(IFNULL(businessHours,'')) FROM stores WHERE id=${ownStore}`);
const origName = hexToStr(origNameHex);
sql(`DELETE FROM store_change_requests WHERE storeId=${ownStore};`);

// ============ 失败路径（不改变状态） ============
log('———— 失败 / 越权 / 校验 ————');
{
  const r = await call('POST', `stores/${ownStore}/change-requests`, S1, { name: `越权夹带-${TAG}`, code: 'HACK' });
  ok('F1', '夹带禁止字段 code → 400 STORE_CHANGE_FIELD_FORBIDDEN', r.status === 400 && r.reason === 'STORE_CHANGE_FIELD_FORBIDDEN', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', `stores/${ownStore}/change-requests`, S1, { name: origName, contactPhone: hexToStr(origPhoneHex) || undefined });
  ok('F2', '无有效变更 → 400 STORE_CHANGE_NO_DIFF', r.status === 400 && r.reason === 'STORE_CHANGE_NO_DIFF', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', `stores/${ownStore}/change-requests`, S1, { contactPhone: 'not-a-phone' });
  ok('F3', '电话格式非法 → 400', r.status === 400, `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', `stores/${otherStore}/change-requests`, S1, { name: `越权-${TAG}` });
  ok('F4', '附属提交别家门店 → 403 STORE_NOT_OWNED', r.status === 403 && r.reason === 'STORE_NOT_OWNED', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('GET', `stores/${otherStore}/change-requests`, S1);
  ok('F5', '附属查看别家门店申请 → 403 STORE_NOT_OWNED', r.status === 403 && r.reason === 'STORE_NOT_OWNED', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('GET', 'stores/change-requests', S1);
  ok('F6', '附属访问审核列表 → 403 PERMISSION_DENIED', r.status === 403, `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', 'stores/change-requests/999999/review', A, { decision: 'APPROVE' });
  ok('F7', '审核不存在的申请 → 404', r.status === 404, `HTTP=${r.status} ${r.reason}`);
}

// ============ 提交 → PENDING ============
log('');
log('———— 提交 / 并发 ————');
const newName = `S101中心店-${TAG}`;
let reqId = 0;
{
  const r = await call('POST', `stores/${ownStore}/change-requests`, S1, {
    name: newName,
    contactPhone: '13800001111',
    businessHours: '09:00-22:00',
    reason: 'S5.3 用例',
  });
  reqId = r.data?.id ?? 0;
  const ch = r.data?.changes ?? {};
  ok('S1', '附属提交本店变更 → PENDING + changes 存 {old,new}', r.status === 201 && r.data?.status === 'PENDING' && ch.name?.old === origName && ch.name?.new === newName,
    `HTTP=${r.status} id=${reqId} nameChange=${JSON.stringify(ch.name)}`);
}
{
  const r = await call('POST', `stores/${ownStore}/change-requests`, S1, { name: `并发-${TAG}` });
  ok('F8', '同门店二次提交（已有 PENDING）→ 409 STORE_CHANGE_PENDING_EXISTS', r.status === 409 && r.reason === 'STORE_CHANGE_PENDING_EXISTS', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('GET', 'stores/change-requests?status=PENDING&pageSize=100', A);
  const found = (r.data?.list ?? []).some((x) => x.id === reqId);
  ok('S2', '主体审核列表可见该申请', r.status === 200 && found, `HTTP=${r.status} total=${r.data?.total} found=${found}`);
}
{
  const r = await call('GET', `stores/change-requests/${reqId}`, A);
  ok('S3', '审核详情返回变更前后对比 + 门店信息', r.status === 200 && !!r.data?.changes && !!r.data?.store, `HTTP=${r.status} store=${r.data?.store?.name}`);
}
{
  const r = await call('POST', `stores/change-requests/${reqId}/review`, S1, { decision: 'APPROVE' });
  ok('F9', '附属审核 → 403 PERMISSION_DENIED', r.status === 403, `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', `stores/change-requests/${reqId}/review`, A, { decision: 'REJECT' });
  ok('F10', '驳回未填原因 → 400 STORE_CHANGE_REASON_REQUIRED', r.status === 400 && r.reason === 'STORE_CHANGE_REASON_REQUIRED', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', `stores/change-requests/${reqId}/cancel`, S1);
  ok('S4', '附属作废本店 PENDING 申请 → 200', ok200(r.status) && r.data?.cancelled === true, `HTTP=${r.status}`);
  const r2 = await call('GET', `stores/${ownStore}/change-requests`, S1);
  ok('S5', '作废后本店申请列表为空（作废生效）', r2.status === 200 && (r2.data ?? []).length === 0, `剩余=${(r2.data ?? []).length}`);
}

// ============ 重新提交 → 通过 → 生效 ============
log('');
log('———— 审核通过（事务生效） ————');
let reqId2 = 0;
{
  const r = await call('POST', `stores/${ownStore}/change-requests`, S1, { name: newName, contactPhone: '13800001111' });
  reqId2 = r.data?.id ?? 0;
  ok('S6', '作废后可重新提交 → 201 PENDING', r.status === 201 && r.data?.status === 'PENDING', `HTTP=${r.status} id=${reqId2}`);
}
{
  const auditBefore = Number(scalar(`SELECT COUNT(*) FROM audit_logs WHERE module='store' AND targetId=${reqId2}`));
  const r = await call('POST', `stores/change-requests/${reqId2}/review`, A, { decision: 'APPROVE', remark: '资料齐全' });
  const dbPhone = scalar(`SELECT IFNULL(contactPhone,'') FROM stores WHERE id=${ownStore}`); // ASCII，回读安全
  const api = await call('GET', `stores/change-requests/${reqId2}`, A); // JSON 走 UTF-8，中文可靠
  const auditAfter = Number(scalar(`SELECT COUNT(*) FROM audit_logs WHERE module='store' AND targetId=${reqId2}`));
  ok(
    'S7',
    '通过 → APPROVED 且 stores 同事务更新（电话落库 + 门店名经 API 校验）',
    ok200(r.status) && r.data?.status === 'APPROVED' && dbPhone === '13800001111' && api.data?.store?.name === newName,
    `HTTP=${r.status} status=${r.data?.status} phone=${dbPhone} storeName(API)=${api.data?.store?.name}`,
  );
  ok('S8', '审核动作写审计', auditAfter > auditBefore, `audit ${auditBefore}→${auditAfter}`);
}
{
  const r = await call('POST', `stores/change-requests/${reqId2}/review`, A, { decision: 'REJECT', remark: '重复处理' });
  ok('F11', '已审核申请再审 → 409 STORE_CHANGE_NOT_PENDING', r.status === 409 && r.reason === 'STORE_CHANGE_NOT_PENDING', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', `stores/change-requests/${reqId2}/cancel`, S1);
  ok('F12', '作废已审核申请 → 409 STORE_CHANGE_NOT_PENDING', r.status === 409 && r.reason === 'STORE_CHANGE_NOT_PENDING', `HTTP=${r.status} ${r.reason}`);
}

// ============ 驳回路径 ============
log('');
log('———— 驳回 ————');
{
  const r = await call('POST', `stores/${ownStore}/change-requests`, S1, { businessHours: '10:00-20:00' });
  const rid = r.data?.id ?? 0;
  const r2 = await call('POST', `stores/change-requests/${rid}/review`, A, { decision: 'REJECT', remark: '营业时间需与商场一致' });
  const dbHours = scalar(`SELECT IFNULL(businessHours,'') FROM stores WHERE id=${ownStore}`);
  ok('S9', '驳回 → REJECTED + 原因落库且 stores 不变', ok200(r2.status) && r2.data?.status === 'REJECTED' && r2.data?.reviewRemark === '营业时间需与商场一致' && dbHours !== '10:00-20:00',
    `HTTP=${r2.status} status=${r2.data?.status} remark=${r2.data?.reviewRemark}`);
}

// ============ 清理 / 还原 ============
sql(`DELETE FROM store_change_requests WHERE storeId=${ownStore};
     UPDATE stores SET name=${unhex(origNameHex)}, contactPhone=${unhex(origPhoneHex)}, businessHours=${unhex(origHoursHex)} WHERE id=${ownStore};`);
const restoredHex = scalar(`SELECT HEX(name) FROM stores WHERE id=${ownStore}`);
ok('S10', '用例后门店名称已完整还原（HEX 与原始一致）', restoredHex === origNameHex, `hex=${restoredHex}`);
log('  （已清理申请并还原 store 字段）');

log(`\n===== S5.3 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail === 0 ? 0 : 1);
