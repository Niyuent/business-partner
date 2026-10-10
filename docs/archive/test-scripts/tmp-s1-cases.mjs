/**
 * S1 验收用例（回归）：auth / RBAC / 入驻审核 / 授权管理 / 审计
 * 全部走真实 HTTP（http://localhost/api/v1）。
 * 破坏性写入（临时入驻申请 + 临时授权）用独立 licenseNo，并在结尾 SQL 清理，保证可重复运行。
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
const loginFull = async (u, p = 'Test@123456') => (await call('POST', 'auth/login', null, { username: u, password: p })).data ?? null;
const tokenOf = async (u) => (await loginFull(u))?.accessToken ?? null;

function sql(statement) {
  writeFileSync('tmp-s1.sql', statement + '\n');
  execSync('docker compose cp tmp-s1.sql mysql:/tmp/s1x.sql', { stdio: 'pipe' });
  execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' shangmeng < /tmp/s1x.sql"`, { stdio: 'pipe' });
}
function query(statement) {
  writeFileSync('tmp-s1.sql', statement + '\n');
  execSync('docker compose cp tmp-s1.sql mysql:/tmp/s1q.sql', { stdio: 'pipe' });
  return execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' -N -B shangmeng < /tmp/s1q.sql"`, { encoding: 'utf8' }).trim();
}
const scalar = (s) => query(s).split('\n')[0]?.trim() ?? '';

const adminLogin = await loginFull('admin');
const A = adminLogin?.accessToken ?? null;
const P = await tokenOf('platform');
const S1 = await tokenOf('sub01');
const S2 = await tokenOf('sub02');
const CK = await tokenOf('clerk01');

// ---------------------------------------------------------------- auth / RBAC
log('———— auth / RBAC ————');
ok('A1', 'admin 登录成功并返回 token', !!A, `token=${A ? 'ok' : 'null'}`);
ok('A2', '登录返回角色 + 权限码快照', Array.isArray(adminLogin?.roles) && adminLogin.roles.includes('MAIN_ADMIN') && (adminLogin?.permissions ?? []).includes('merchant:audit'),
  `roles=${JSON.stringify(adminLogin?.roles)} perms#${adminLogin?.permissions?.length}`);
{
  const r = await call('POST', 'auth/login', null, { username: 'admin', password: 'wrong-password-xyz' });
  ok('A3', '错误口令 → 401', r.status === 401, `HTTP=${r.status} ${r.reason ?? r.msg}`);
}
{
  const r = await call('GET', 'auth/profile', null);
  ok('A4', '未登录访问 /auth/profile → 401', r.status === 401, `HTTP=${r.status} ${r.reason ?? r.msg}`);
}
{
  const r = await call('GET', 'auth/profile', A);
  const d = r.data ?? {};
  const u = d.user ?? d;
  ok('A5', 'admin profile：userType=MERCHANT 且 merchant.type=MAIN', r.status === 200 && u.userType === 'MERCHANT' && (d.merchant ?? u.merchant)?.type === 'MAIN',
    `userType=${u.userType} type=${(d.merchant ?? u.merchant)?.type}`);
}
{
  const r = await call('GET', 'auth/profile', P);
  const d = r.data ?? {};
  const u = d.user ?? d;
  ok('A6', 'platform profile：userType=PLATFORM 且无商家归属', r.status === 200 && u.userType === 'PLATFORM' && !(d.merchant ?? u.merchant),
    `userType=${u.userType}`);
}
{
  const r = await call('GET', 'auth/permissions', S1);
  ok('A7', '权限接口：sub01 roles=[SUB_ADMIN]', r.status === 200 && (r.data?.roles ?? []).includes('SUB_ADMIN'), `roles=${JSON.stringify(r.data?.roles)}`);
}
{
  const r = await call('GET', 'merchants', S2);
  ok('A8', 'sub02（无 merchant:view）访问 /merchants → 403', r.status === 403, `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('GET', 'audit-logs', S1);
  ok('A9', 'sub01（无 audit:view）访问 /audit-logs → 403', r.status === 403, `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('GET', 'audit-logs', A, null, { page: 1, pageSize: 5 });
  ok('A10', 'admin 审计日志 total>0 且含 authorization 模块', r.status === 200 && r.data?.total > 0 && (r.data.list ?? []).some((x) => x.module === 'authorization'),
    `total=${r.data?.total}`);
}

// ---------------------------------------------------------------- 入驻审核
log('');
log('———— 入驻审核 ————');
{
  const r = await call('GET', 'merchants/applications', A, null, { page: 1, pageSize: 20, status: 'PENDING' });
  ok('B1', '待审列表含 seed 的 PENDING 商家(#4)', r.status === 200 && (r.data?.list ?? []).some((x) => x.id === 4), `total=${r.data?.total}`);
}
const lic = 'TEST-S1-' + Date.now();
let appId = 0;
{
  const r = await call('POST', 'merchants/applications', null, {
    name: 'S1回归测试店', contactName: '测试联系人', contactPhone: '13900009999', licenseNo: lic,
    province: '上海市', city: '上海市', district: '浦东新区', address: '测试路 1 号',
  });
  appId = Number(scalar(`SELECT id FROM merchants WHERE licenseNo='${lic}' LIMIT 1`));
  ok('B2', '公开提交入驻申请 → 成功且落库 PENDING', ok200(r.status) && appId > 0 && scalar(`SELECT status FROM merchants WHERE id=${appId}`) === 'PENDING',
    `HTTP=${r.status} id=${appId}`);
}
{
  const r = await call('POST', `merchants/applications/${appId}/approve`, S2, { auditRemark: '越权审核尝试' });
  ok('B3', 'sub02（无 merchant:audit）审核 → 403', r.status === 403, `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', `merchants/applications/${appId}/approve`, A, { auditRemark: 'S1 回归通过', createAccount: true });
  const st = scalar(`SELECT status FROM merchants WHERE id=${appId}`);
  const acct = Number(scalar(`SELECT COUNT(*) FROM admin_users WHERE merchantId=${appId}`));
  ok('B4', 'admin 审核通过 → APPROVED 且创建账号', ok200(r.status) && st === 'APPROVED' && acct >= 1, `HTTP=${r.status} status=${st} acct=${acct}`);
}
{
  const r = await call('POST', `merchants/applications/${appId}/approve`, A, {});
  ok('B5', '重复审核已通过的单 → 4xx', r.status >= 400, `HTTP=${r.status} ${r.reason}`);
}

// ---------------------------------------------------------------- 授权管理
log('');
log('———— 授权管理 ————');
{
  const r = await call('GET', 'authorizations', A, null, { page: 1, pageSize: 20 });
  ok('C1', 'seed 授权列表含 SUB-01 启用授权', r.status === 200 && (r.data?.list ?? []).some((x) => x.subMerchantId === 2 && x.status === 'ENABLED'),
    `total=${r.data?.total}`);
}
{
  const r = await call('GET', 'me/authorizations', S1);
  ok('C2', 'sub01 me/authorizations 授权范围含 T1(1001)', r.status === 200 && JSON.stringify(r.data ?? {}).includes('1001'), `data=${JSON.stringify(r.data ?? {}).slice(0, 100)}`);
}
sql(`DELETE FROM merchant_authorization_templates WHERE authorizationId IN (SELECT id FROM merchant_authorizations WHERE subMerchantId=3 AND mainMerchantId=1);
     DELETE FROM merchant_authorizations WHERE subMerchantId=3 AND mainMerchantId=1;`); // 清理历史，保证可重复
let authId = 0;
{
  const r = await call('POST', 'authorizations', A, { subMerchantId: 3, authType: 'ISSUE_MAIN_COUPON', templateScope: 'SPECIFIED', templateIds: [1001] });
  authId = Number(scalar(`SELECT id FROM merchant_authorizations WHERE subMerchantId=3 AND mainMerchantId=1 ORDER BY id DESC LIMIT 1`));
  ok('C3', '主体给 sub02 授权(SPECIFIED T1) → 成功', ok200(r.status) && authId > 0, `HTTP=${r.status} id=${authId}`);
}
{
  const r = await call('POST', 'authorizations', A, { subMerchantId: 3, authType: 'ISSUE_MAIN_COUPON', templateScope: 'SPECIFIED', templateIds: [1001] });
  ok('C4', '重复授权 → 409 AUTHORIZATION_EXISTS', r.status === 409 && r.reason === 'AUTHORIZATION_EXISTS', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('PATCH', `authorizations/${authId}/disable`, A, { revokeReason: 'S1 回归关闭' });
  ok('C5', '关闭授权 → 成功', ok200(r.status), `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('PATCH', `authorizations/${authId}/disable`, A, {});
  ok('C6', '重复关闭 → 幂等 alreadyDisabled=true', ok200(r.status) && r.data?.alreadyDisabled === true, `HTTP=${r.status} alreadyDisabled=${r.data?.alreadyDisabled}`);
}
{
  const r = await call('GET', 'authorizations/logs', A, null, { page: 1, pageSize: 10 });
  ok('C7', '授权日志有记录', r.status === 200 && r.data?.total > 0, `total=${r.data?.total}`);
}
{
  const r = await call('GET', 'me/authorizations', S1, null, { subMerchantId: 3 });
  ok('C8', 'sub01 传别家 subMerchantId=3 → 403（不静默忽略）', r.status === 403, `HTTP=${r.status} ${r.reason}`);
}

// ---------------------------------------------------------------- 清理本脚本写入
sql(`DELETE FROM admin_user_roles WHERE adminUserId IN (SELECT id FROM admin_users WHERE merchantId=${appId || -1});
     DELETE FROM admin_users WHERE merchantId=${appId || -1};
     DELETE FROM merchant_authorization_templates WHERE authorizationId IN (SELECT id FROM merchant_authorizations WHERE subMerchantId=3 AND mainMerchantId=1);
     DELETE FROM merchant_authorizations WHERE subMerchantId=3 AND mainMerchantId=1;
     DELETE FROM merchants WHERE id=${appId || -1};`);
log(`  （已清理临时申请 #${appId} 与临时授权 #${authId}）`);

log(`\n===== S1 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail === 0 ? 0 : 1);
