/**
 * S5.1 验收用例（C 端用户鉴权 / 双向隔离 / userId 防伪）
 * 全部走真实 HTTP（http://localhost/api/v1）。每次用唯一 code 登录 → 生成独立 C 端用户。
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
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, data: j.data, reason: j.data?.reasonCode, msg: j.message };
}

const admin = (await call('POST', 'auth/login', null, { username: 'admin', password: 'Test@123456' })).data?.accessToken;
const code = 's51-' + Date.now();

// ---------------------------------------------------------------- C 端登录
log('———— C 端登录（code2session 模拟） ————');
const ul = await call('POST', 'auth/user-login', null, { code });
const ut = ul.data?.accessToken;
const uid = ul.data?.user?.id;
ok('L1', 'user-login 走通并签发 C 端 token', ul.status === 201 && !!ut && uid > 0, `HTTP=${ul.status} userId=${uid} openid=${ul.data?.user?.openid}`);
ok('L2', '同一 code 再登录 → 同一用户（openid 幂等）',
  (await call('POST', 'auth/user-login', null, { code })).data?.user?.id === uid, `第二次 userId=${uid}`);
{
  const r = await call('POST', 'auth/user-login', null, {});
  ok('L3', '缺 code → 400', r.status === 400, `HTTP=${r.status} ${r.msg?.slice(0, 40)}`);
}

// ---------------------------------------------------------------- 双向隔离
log('');
log('———— 令牌双向隔离 ————');
{
  const r = await call('GET', 'merchants', ut);
  ok('I1', 'C 端 token → 后台接口 /merchants → 403', r.status === 403 && r.reason === 'FORBIDDEN_SCOPE', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('GET', 'auth/profile', ut);
  ok('I2', 'C 端 token → 后台接口 /auth/profile → 403', r.status === 403, `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('GET', 'h5/points/account', admin);
  ok('I3', '后台 token → C 端接口 /h5/points/account → 403', r.status === 403 && r.reason === 'FORBIDDEN_SCOPE', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('GET', 'h5/points/account', null);
  ok('I4', '无 token → /h5/** → 401', r.status === 401, `HTTP=${r.status} ${r.reason}`);
}

// ---------------------------------------------------------------- C 端可用
log('');
log('———— C 端令牌可用 ————');
{
  const r = await call('GET', 'h5/me', ut);
  ok('C1', '/h5/me → 200', r.status === 200 && r.data?.id === uid, `HTTP=${r.status} id=${r.data?.id}`);
}
{
  const r = await call('GET', 'h5/points/account', ut);
  ok('C2', '/h5/points/account → 200 且新用户账户存在（余额 0）', r.status === 200 && r.data?.account?.balance === 0, `HTTP=${r.status} balance=${r.data?.account?.balance}`);
}
{
  const r = await call('GET', 'h5/templates', ut);
  ok('C3', '/h5/templates → 200 且每条含 status/pointsCost', r.status === 200 && (r.data?.list ?? []).every((t) => t.status === 'PUBLISHED' && t.pointsCost > 0), `n=${r.data?.list?.length}`);
}
{
  const r = await call('GET', 'h5/points/transactions', ut);
  ok('C4', '/h5/points/transactions → 200', r.status === 200 && typeof r.data?.total === 'number', `HTTP=${r.status} total=${r.data?.total}`);
}

// ---------------------------------------------------------------- userId 防伪 + 兑换
log('');
log('———— userId 防伪 / 兑换 ————');
await call('POST', 'points/adjust', admin, { userId: uid, amount: 100, reason: 'S5.1 用例充值' });
{
  const r = await call('POST', 'h5/exchange', ut, { userId: uid + 999, templateId: 1002, requestId: 'forged-' + Date.now() });
  ok('E1', '伪造 userId 兑换 → 403 FORBIDDEN_SCOPE', r.status === 403 && r.reason === 'FORBIDDEN_SCOPE', `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('POST', 'h5/exchange', ut, { userId: uid, templateId: 1002, requestId: 'ok-' + Date.now() });
  ok('E2', '真实 userId 兑换（T2 需 5 分）→ 201 且返回券码', r.status === 201 && (r.data?.code ?? '').length >= 12, `HTTP=${r.status} code=${r.data?.code} cost=${r.data?.pointsCost}`);
}
{
  const acc = await call('GET', 'h5/points/account', ut);
  ok('E3', '兑换后余额 = 100 - 5 = 95', acc.data?.account?.balance === 95, `balance=${acc.data?.account?.balance}`);
}

log(`\n===== S5.1 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail === 0 ? 0 : 1);
