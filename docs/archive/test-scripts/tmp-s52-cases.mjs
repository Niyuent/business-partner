/**
 * S5.2 验收用例：用户管理（主体后台 + 附属/店员隔离 + 启停 + 绑手机号 + 审计）
 * 真实 HTTP；自建临时用户/订单，结尾 SQL 清理，保证可重复。
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
  writeFileSync('tmp-s52.sql', statement + '\n');
  execSync('docker compose cp tmp-s52.sql mysql:/tmp/s52x.sql', { stdio: 'pipe' });
  execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' shangmeng < /tmp/s52x.sql"`, { stdio: 'pipe' });
}
function query(statement) {
  writeFileSync('tmp-s52.sql', statement + '\n');
  execSync('docker compose cp tmp-s52.sql mysql:/tmp/s52q.sql', { stdio: 'pipe' });
  return execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' -N -B shangmeng < /tmp/s52q.sql"`, { encoding: 'utf8' }).trim();
}
const scalar = (s) => query(s).split('\n')[0]?.trim() ?? '';

const A = await login('admin');
const S1 = await login('sub01'); // merchant 2（附属）
const CK = await login('clerk01'); // merchant 2 / store 101

// ---- 造数：9001 在商户 2/门店 101 消费；9002 只在商户 1 消费 ----
sql(`DELETE FROM orders WHERE userId IN (9001,9002);
     DELETE FROM point_accounts WHERE userId IN (9001,9002);
     DELETE FROM point_transactions WHERE userId IN (9001,9002);
     DELETE FROM users WHERE id IN (9001,9002);
     INSERT INTO users (id, phone, nickname, status, registeredAt, createdAt, updatedAt)
       VALUES (9001,'13900009001','S5.2用户A','ACTIVE',UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP()),
              (9002,'13900009002','S5.2用户B','ACTIVE',UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP());
     INSERT INTO orders (orderNo,userId,merchantId,storeId,totalAmount,payAmount,orderType,source,consumeTime,createdAt,updatedAt)
       VALUES ('S52-ORD-9001',9001,2,101,100,100,'CONSUME','IMPORT',UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP()),
              ('S52-ORD-9002',9002,1,101,50,50,'CONSUME','IMPORT',UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP());`);

log('———— 列表 / 筛选 / 权限 ————');
{
  const r = await call('GET', 'users', A, null, { page: 1, pageSize: 50 });
  const ids = (r.data?.list ?? []).map((x) => x.id);
  ok('L1', 'admin 列表 200 且含临时用户 9001/9002', r.status === 200 && ids.includes(9001) && ids.includes(9002), `HTTP=${r.status} total=${r.data?.total}`);
  ok('L2', '列表条目含积分/订单计数聚合字段', (r.data?.list ?? []).find((x) => x.id === 9001)?.orderCount === 1, `orderCount=${(r.data?.list ?? []).find((x) => x.id === 9001)?.orderCount}`);
}
{
  const r = await call('GET', 'users', A, null, { phone: '13900009001' });
  ok('L3', '按手机号筛选命中 1 条', r.data?.total === 1 && r.data.list[0].id === 9001, `total=${r.data?.total}`);
}
{
  const r = await call('GET', 'users', S1, null, { page: 1, pageSize: 50 });
  const ids = (r.data?.list ?? []).map((x) => x.id);
  ok('L4', '附属 sub01 仅见「本商家消费过」的用户（含 9001、不含 9002）', r.status === 200 && ids.includes(9001) && !ids.includes(9002), `ids 含9001=${ids.includes(9001)} 含9002=${ids.includes(9002)}`);
}
{
  const r = await call('GET', 'users', CK, null, { page: 1, pageSize: 50 });
  const ids = (r.data?.list ?? []).map((x) => x.id);
  ok('L5', '店员 clerk01 仅见本店消费过的用户（含 9001、不含 9002）', r.status === 200 && ids.includes(9001) && !ids.includes(9002), `含9001=${ids.includes(9001)} 含9002=${ids.includes(9002)}`);
}

log('');
log('———— 详情 / 越权 ————');
{
  const r = await call('GET', 'users/9001', A);
  ok('D1', 'admin 详情 200（基本信息 + 积分 + 券 + 消费 + 核销 + 来源商家）',
    r.status === 200 && r.data?.profile?.id === 9001 && !!r.data?.account && Array.isArray(r.data?.orders) && r.data.orders.length >= 1 && Array.isArray(r.data?.sourceMerchants),
    `HTTP=${r.status} orders=${r.data?.orders?.length} account=${JSON.stringify(r.data?.account)}`);
}
{
  const r = await call('GET', 'users/9002', S1);
  ok('D2', '附属查看不在本商家消费的用户 9002 → 404（越权拦截）', r.status === 404, `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('GET', 'users/999999', A);
  ok('D3', '用户不存在 → 404', r.status === 404, `HTTP=${r.status} ${r.reason}`);
}

log('');
log('———— 启停（user:edit） ————');
{
  const r = await call('PATCH', 'users/9001/status', S1, { status: 'DISABLED' });
  ok('E1', '附属（无 user:edit）启停 → 403', r.status === 403, `HTTP=${r.status} ${r.reason}`);
}
let auditBefore = Number(scalar(`SELECT COUNT(*) FROM audit_logs WHERE module='user' AND targetId=9001`));
{
  const r = await call('PATCH', 'users/9001/status', A, { status: 'DISABLED' });
  const st = scalar(`SELECT status FROM users WHERE id=9001`);
  ok('E2', 'admin 禁用 → 200 且状态变更', ok200(r.status) && st === 'DISABLED' && r.data?.unchanged === false, `HTTP=${r.status} status=${st}`);
  const auditAfter = Number(scalar(`SELECT COUNT(*) FROM audit_logs WHERE module='user' AND targetId=9001`));
  ok('E3', '禁用写审计', auditAfter > auditBefore, `audit ${auditBefore}→${auditAfter}`);
}
{
  const r = await call('PATCH', 'users/9001/status', A, { status: 'DISABLED' });
  ok('E4', '重复禁用 → 幂等（unchanged=true）', ok200(r.status) && r.data?.unchanged === true, `HTTP=${r.status} unchanged=${r.data?.unchanged}`);
  await call('PATCH', 'users/9001/status', A, { status: 'ACTIVE' }); // 还原
}

log('');
log('———— 绑定手机号（唯一性） ————');
{
  const r = await call('POST', 'users/9001/bind-phone', A, { phone: '13800000001' }); // 张三已占用
  ok('B1', '绑定已被占用的手机号 → 409 USER_PHONE_EXISTS', r.status === 409 && r.reason === 'USER_PHONE_EXISTS', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', 'users/9001/bind-phone', A, { phone: '13900009009' });
  const ph = scalar(`SELECT phone FROM users WHERE id=9001`);
  ok('B2', '绑定新手机号 → 200 且落库', ok200(r.status) && ph === '13900009009' && r.data?.unchanged === false, `HTTP=${r.status} phone=${ph}`);
}
{
  const r = await call('POST', 'users/9001/bind-phone', A, { phone: 'not-a-phone' });
  ok('B3', '手机号格式非法 → 400', r.status === 400, `HTTP=${r.status}`);
}

// ---- 清理 ----
sql(`DELETE FROM orders WHERE userId IN (9001,9002);
     DELETE FROM point_accounts WHERE userId IN (9001,9002);
     DELETE FROM point_transactions WHERE userId IN (9001,9002);
     DELETE FROM users WHERE id IN (9001,9002);`);
log('  （已清理临时用户 9001/9002 及其订单）');

log(`\n===== S5.2 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail === 0 ? 0 : 1);
