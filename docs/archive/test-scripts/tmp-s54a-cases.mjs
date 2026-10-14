/**
 * S5.4-A 验收用例：站内信后端（列表 / 未读数 / 已读 / 全部已读 / 主体发布）
 * 真实 HTTP；测试通知标题统一 ASCII 前缀 S54A-，开头与结尾按前缀清理，保证可重复。
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost/api/v1';
const ROOT_PWD = readFileSync('.env', 'utf8').match(/^MYSQL_ROOT_PASSWORD=(.+)$/m)[1].trim();
const TAG = Date.now().toString().slice(-6);
const PREFIX = `S54A-${TAG}`;
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
  writeFileSync('tmp-s54a.sql', statement + '\n');
  execSync('docker compose cp tmp-s54a.sql mysql:/tmp/s54ax.sql', { stdio: 'pipe' });
  execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' shangmeng < /tmp/s54ax.sql"`, { stdio: 'pipe' });
}
function scalar(s) {
  writeFileSync('tmp-s54a.sql', s + '\n');
  execSync('docker compose cp tmp-s54a.sql mysql:/tmp/s54aq.sql', { stdio: 'pipe' });
  return execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' -N -B shangmeng < /tmp/s54aq.sql"`, { encoding: 'utf8' }).trim().split('\n')[0]?.trim() ?? '';
}

const A = await login('admin'); // 主体 merchant=1
const P = await login('platform'); // 平台（merchantId=null）
const S1 = await login('sub01'); // 附属 merchant=2，门店 101/102
const S2 = await login('sub02'); // 附属 merchant=3，门店 201
const CK = await login('clerk01'); // 店员 store=101

sql(`DELETE FROM notifications WHERE title LIKE 'S54A-%';`);
const auditCount = () => Number(scalar(`SELECT COUNT(*) FROM audit_logs WHERE module='notification' AND action='notification:send'`));
const has = (r, id) => (r.data?.list ?? []).some((n) => n.id === id);

// ============ 发布侧：失败 / 越权 / 校验（不改变状态） ============
log('———— 发布：越权 / 校验 ————');
{
  const r = await call('POST', 'notifications', S1, { targetType: 'MERCHANT', targetIds: [3], title: `${PREFIX}-x`, content: '附属越权发布' });
  ok('F1', '附属发布 → 403 PERMISSION_DENIED', r.status === 403, `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', 'notifications', CK, { targetType: 'STORE', targetIds: [101], title: `${PREFIX}-x`, content: '店员越权发布' });
  ok('F2', '店员发布 → 403 PERMISSION_DENIED', r.status === 403, `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', 'notifications', A, { targetType: 'MERCHANT', targetIds: [999999], title: `${PREFIX}-x`, content: '不存在的商家' });
  ok('F3', '发给不存在的商家 → 403 FORBIDDEN_SCOPE', r.status === 403 && r.reason === 'FORBIDDEN_SCOPE', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', 'notifications', A, { targetType: 'MERCHANT', targetIds: [1], title: `${PREFIX}-x`, content: '发给主体自己（非直属附属）' });
  ok('F4', '目标非直属附属（主体自身）→ 403 FORBIDDEN_SCOPE', r.status === 403 && r.reason === 'FORBIDDEN_SCOPE', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', 'notifications', A, { targetType: 'STORE', targetIds: [999999], title: `${PREFIX}-x`, content: '不存在的门店' });
  ok('F5', '发给范围外门店 → 403 STORE_NOT_OWNED', r.status === 403 && r.reason === 'STORE_NOT_OWNED', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', 'notifications', A, { targetType: 'MERCHANT', title: `${PREFIX}-x`, content: '缺 targetIds' });
  ok('F6', 'MERCHANT 缺 targetIds → 400 NOTIFICATION_TARGET_REQUIRED', r.status === 400 && r.reason === 'NOTIFICATION_TARGET_REQUIRED', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', 'notifications', A, { targetType: 'ALL_MERCHANTS', targetIds: [2], title: `${PREFIX}-x`, content: 'ALL 夹带 targetIds' });
  ok('F7', 'ALL_MERCHANTS 夹带 targetIds → 400 NOTIFICATION_TARGET_INVALID', r.status === 400 && r.reason === 'NOTIFICATION_TARGET_INVALID', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', 'notifications', A, { targetType: 'MERCHANT', targetIds: [2], title: '   ', content: '空白标题' });
  ok('F8', '标题全空白 → 400', r.status === 400, `HTTP=${r.status} ${r.msg}`);
}
{
  const r = await call('GET', 'notifications', null);
  ok('F9', '未带 token → 401', r.status === 401, `HTTP=${r.status}`);
}
const failedSends = Number(scalar(`SELECT COUNT(*) FROM notifications WHERE title LIKE '${PREFIX}%'`));
ok('F10', '以上失败请求均未落库', failedSends === 0, `rows=${failedSends}`);

// ============ 发给商家 2：商家维度隔离 ============
log('');
log('———— 发给附属商家（MERCHANT 维度） ————');
let m2Id = 0;
{
  const before = auditCount();
  const r = await call('POST', 'notifications', A, { targetType: 'MERCHANT', targetIds: [2], title: `${PREFIX}-M2`, content: '致城南旗舰店：本月对账单已生成', level: 'IMPORTANT' });
  const after = auditCount();
  m2Id = Number(scalar(`SELECT id FROM notifications WHERE title='${PREFIX}-M2'`));
  ok('S1', '主体发给附属 2 → 201 count=1', r.status === 201 && r.data?.count === 1 && r.data?.receiverType === 'MERCHANT', `HTTP=${r.status} count=${r.data?.count} id=${m2Id}`);
  ok('S2', '发布写审计 notification:send', after === before + 1, `audit ${before}→${after}`);
}
{
  const r = await call('GET', 'notifications?pageSize=100', S1);
  ok('S3', 'sub01 列表可见 + 带 unreadCount', r.status === 200 && has(r, m2Id) && r.data?.unreadCount >= 1, `HTTP=${r.status} total=${r.data?.total} unread=${r.data?.unreadCount}`);
}
{
  const r = await call('GET', 'notifications?pageSize=100', S2);
  ok('F11', 'sub02 看不到发给商家 2 的通知', r.status === 200 && !has(r, m2Id), `HTTP=${r.status} total=${r.data?.total}`);
}
{
  const r = await call('GET', 'notifications?pageSize=100&merchantId=2&receiverId=2', S2);
  ok('F12', 'sub02 伪造 merchantId/receiverId 参数仍看不到', !(r.status === 200 && has(r, m2Id)), `HTTP=${r.status} total=${r.data?.total}`);
}
{
  const r = await call('GET', 'notifications?pageSize=100', CK);
  ok('F13', '店员看不到商家级（MERCHANT）通知', r.status === 200 && !has(r, m2Id), `HTTP=${r.status} total=${r.data?.total}`);
}
{
  const r = await call('PATCH', `notifications/${m2Id}/read`, S2);
  const st = scalar(`SELECT readStatus FROM notifications WHERE id=${m2Id}`);
  ok('F14', 'sub02 标记别家通知已读 → 404（不泄露）且状态未变', r.status === 404 && r.reason === 'RESOURCE_NOT_FOUND' && st === 'UNREAD', `HTTP=${r.status} ${r.reason} db=${st}`);
}

// ============ 发给门店 101：门店维度 ============
log('');
log('———— 发给门店（STORE 维度） ————');
let s101Id = 0;
{
  const r = await call('POST', 'notifications', A, { targetType: 'STORE', targetIds: [101], title: `${PREFIX}-S101`, content: '致中心店：周末客流高峰请备足核销人手' });
  s101Id = Number(scalar(`SELECT id FROM notifications WHERE title='${PREFIX}-S101'`));
  ok('S4', '主体发给门店 101 → 201 count=1', r.status === 201 && r.data?.count === 1 && r.data?.receiverType === 'STORE', `HTTP=${r.status} id=${s101Id}`);
}
{
  const r = await call('GET', 'notifications?pageSize=100', CK);
  const c = await call('GET', 'notifications/unread-count', CK);
  ok('S5', '店员可见本店通知，未读数=1', r.status === 200 && has(r, s101Id) && c.data?.unreadCount === 1, `HTTP=${r.status} unread=${c.data?.unreadCount}`);
}
{
  const r = await call('GET', 'notifications?pageSize=100', S1);
  ok('S6', 'sub01 同时可见旗下门店 101 的通知', r.status === 200 && has(r, s101Id) && has(r, m2Id), `HTTP=${r.status} total=${r.data?.total}`);
}
{
  const r = await call('GET', 'notifications?pageSize=100', S2);
  ok('F15', 'sub02 看不到门店 101 的通知', r.status === 200 && !has(r, s101Id), `HTTP=${r.status}`);
}
{
  const r = await call('PATCH', `notifications/${s101Id}/read`, CK);
  ok('S7', '店员标记已读 → READ + alreadyRead=false', r.status === 200 && r.data?.readStatus === 'READ' && r.data?.alreadyRead === false && !!r.data?.readAt, `HTTP=${r.status} ${r.data?.readStatus} already=${r.data?.alreadyRead}`);
  const r2 = await call('PATCH', `notifications/${s101Id}/read`, CK);
  const c = await call('GET', 'notifications/unread-count', CK);
  ok('S8', '重复标记已读幂等 → 200 alreadyRead=true，未读数归 0', r2.status === 200 && r2.data?.alreadyRead === true && c.data?.unreadCount === 0, `HTTP=${r2.status} already=${r2.data?.alreadyRead} unread=${c.data?.unreadCount}`);
}
{
  const r = await call('PATCH', 'notifications/abc/read', CK);
  ok('F16', '非法 id → 400', r.status === 400, `HTTP=${r.status}`);
}

// ============ 列表筛选 / 分页 / 全部已读 ============
log('');
log('———— 筛选 / 分页 / 全部已读 ————');
{
  const r = await call('GET', 'notifications?readStatus=UNREAD&pageSize=100', S1);
  const all = (r.data?.list ?? []).every((n) => n.readStatus === 'UNREAD');
  ok('S9', 'readStatus=UNREAD 只返回未读（且不含已读的 S101）', r.status === 200 && all && has(r, m2Id) && !has(r, s101Id), `HTTP=${r.status} n=${r.data?.list?.length}`);
}
{
  const r = await call('GET', 'notifications?page=1&pageSize=1', S1);
  ok('S10', '分页 pageSize=1 → 1 条且 total≥2', r.status === 200 && r.data?.list?.length === 1 && r.data?.total >= 2, `HTTP=${r.status} total=${r.data?.total}`);
}
{
  const r = await call('PATCH', 'notifications/read-all', S1);
  const c = await call('GET', 'notifications/unread-count', S1);
  const st = scalar(`SELECT readStatus FROM notifications WHERE id=${m2Id}`);
  ok('S11', 'sub01 全部已读 → updated≥1、未读数 0、库内 READ', r.status === 200 && r.data?.updated >= 1 && c.data?.unreadCount === 0 && st === 'READ', `HTTP=${r.status} updated=${r.data?.updated} unread=${c.data?.unreadCount} db=${st}`);
}

// ============ 广播：ALL_MERCHANTS / ALL_STORES ============
log('');
log('———— 广播展开 ————');
{
  const expect = Number(scalar(`SELECT COUNT(*) FROM merchants WHERE type='SUB' AND status='APPROVED' AND parentId=1`));
  const r = await call('POST', 'notifications', A, { targetType: 'ALL_MERCHANTS', title: `${PREFIX}-ALLM`, content: '致全体附属商家：系统将于周日凌晨维护' });
  const rows = Number(scalar(`SELECT COUNT(*) FROM notifications WHERE title='${PREFIX}-ALLM'`));
  ok('S12', '主体 ALL_MERCHANTS → 展开为直属已审核附属各一行', r.status === 201 && r.data?.count === expect && rows === expect && expect > 0, `HTTP=${r.status} count=${r.data?.count} expect=${expect} rows=${rows}`);
  const s2 = await call('GET', 'notifications?pageSize=100', S2);
  ok('S13', 'sub02 收到广播（各自独立一行）', (s2.data?.list ?? []).some((n) => n.title === `${PREFIX}-ALLM` && n.readStatus === 'UNREAD'), `HTTP=${s2.status}`);
}
{
  const expect = Number(scalar(`SELECT COUNT(*) FROM stores s JOIN merchants m ON m.id=s.merchantId WHERE s.status='OPEN' AND m.type='SUB' AND m.status='APPROVED'`));
  const r = await call('POST', 'notifications', P, { targetType: 'ALL_STORES', title: `${PREFIX}-ALLS`, content: '致全体门店：请核对本周核销记录' });
  ok('S14', '平台 ALL_STORES → 展开为全部营业门店各一行', r.status === 201 && r.data?.count === expect && expect > 0, `HTTP=${r.status} count=${r.data?.count} expect=${expect}`);
}
{
  const r = await call('GET', 'notifications', P);
  ok('S15', '平台账号无接收身份 → 列表为空', r.status === 200 && r.data?.total === 0 && r.data?.unreadCount === 0, `HTTP=${r.status} total=${r.data?.total}`);
}
{
  const r = await call('GET', 'notifications?pageSize=100', A);
  const others = (r.data?.list ?? []).filter((n) => n.title?.startsWith(PREFIX));
  ok('S16', '主体只看到发给自己的（seed 异常订单提醒），看不到自己发出的', r.status === 200 && r.data?.total >= 1 && others.length === 0, `HTTP=${r.status} total=${r.data?.total} leaked=${others.length}`);
}

// ============ 清理 ============
sql(`DELETE FROM notifications WHERE title LIKE 'S54A-%';`);
log('  （已清理 S54A- 前缀测试通知；审计日志保留）');

log(`\n===== S5.4-A 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail === 0 ? 0 : 1);
