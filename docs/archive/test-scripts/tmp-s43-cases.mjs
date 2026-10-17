/**
 * S4.3 报表中心验收用例（S6-A 补齐：此前是唯一没有回归脚本的模块）
 *
 * 覆盖：
 *  1. 六张报表 GET /reports/* 全部 200 且返回结构完整
 *  2. 导出 GET /reports/:key/export 返回 CSV 流（Content-Type + UTF-8 BOM + 表头）
 *  3. 数据隔离：附属看到的报表**收敛到本商家**（不是 403，而是「看不到别家」）；
 *     附属显式传别家 merchantId 也不越权；店员收敛到本店
 *  4. 权限：店员无 report:export → 403；非法 key → 400；未登录 → 401
 *
 * 真实 HTTP（http://localhost/api/v1）。本脚本只读，不造数据、无需清理。
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

const REPORT_KEYS = [
  'merchant-onboarding',
  'orders-summary',
  'coupon-summary',
  'points-summary',
  'store-settlement',
  'authorization-logs',
];

async function call(method, path, token, body) {
  const res = await fetch(BASE + '/' + path, {
    method,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, data: j.data, msg: j.message, reason: j.data?.reasonCode };
}

/**
 * 导出接口返回纯 CSV 文本（不经 ApiResponse 包装），需单独取字节 + headers。
 *
 * 注意：**不能用 `res.text()` 判断 BOM** —— WHATWG fetch 的 UTF-8 解码会把 BOM 剥掉，
 * 导致「服务端明明发了 EF BB BF、前端却看不到」的假阴性。这里按原始字节判断。
 */
async function callRaw(path, token) {
  const res = await fetch(BASE + '/' + path, {
    headers: token ? { Authorization: 'Bearer ' + token } : {},
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  return { status: res.status, type: res.headers.get('content-type') ?? '', text: buf.toString('utf8'), hasBom, bytes: buf.length };
}

const login = async (u) =>
  (await call('POST', 'auth/login', null, { username: u, password: 'Test@123456' })).data?.accessToken ?? null;

// ---------------------------------------------------------------- 登录
const A = await login('admin'); // 主体（merchantId=1）
const S1 = await login('sub01'); // 附属（merchantId=2）
const S2 = await login('sub02'); // 附属（merchantId=3）
const CK = await login('clerk01'); // 店员（storeId=101, merchantId=2）
ok('准备', '四个账号登录', !!(A && S1 && S2 && CK), `admin=${!!A} sub01=${!!S1} sub02=${!!S2} clerk01=${!!CK}`);

// ================================================================ 1. 六张报表 200 + 结构
log('———— 六张报表 ————');

/** 每张报表：返回体是否含核心字段（各自口径不同，逐张断言） */
const SHAPES = {
  'merchant-onboarding': (d) => typeof d?.summary?.total === 'number' && Array.isArray(d.byStatus) && Array.isArray(d.monthly),
  'orders-summary': (d) =>
    typeof d?.summary?.count === 'number' && Array.isArray(d.byStatus) && Array.isArray(d.byMerchant) && Array.isArray(d.daily),
  'coupon-summary': (d) => !!d?.summary && Array.isArray(d.byStatus) && Array.isArray(d.byTemplate),
  'points-summary': (d) => !!d?.summary && Array.isArray(d.byType),
  'store-settlement': (d) =>
    typeof d?.summary?.purchaseAmount === 'number' &&
    typeof d?.summary?.redemptionAmount === 'number' &&
    Array.isArray(d.byMerchant),
  'authorization-logs': (d) => typeof d?.total === 'number' && Array.isArray(d.byStatus) && Array.isArray(d.list),
};

const counts = {};
for (const key of REPORT_KEYS) {
  const r = await call('GET', `reports/${key}?page=1&pageSize=20`, A);
  counts[key] = r.data;
  ok('报表', `GET /reports/${key} → 200 且结构完整`, r.status === 200 && SHAPES[key](r.data), `HTTP=${r.status}`);
}

// 主体口径基线（供隔离断言对比）
const mainTotal = counts['merchant-onboarding']?.summary?.total ?? -1;
ok('报表', '主体看得到全平台商家（>1）', mainTotal > 1, `merchant-onboarding.summary.total=${mainTotal}`);

// ================================================================ 2. 导出（CSV 流）
log('———— 导出 ————');

/** 各报表导出的首列表头（与 report.service.ts exportCsv 的定义一一对应） */
const EXPORT_HEADER = {
  'merchant-onboarding': '月份',
  'orders-summary': '商家',
  'coupon-summary': '券模板',
  'points-summary': '流水类型',
  'store-settlement': '商家',
  'authorization-logs': '授权id',
};

for (const key of REPORT_KEYS) {
  const r = await callRaw(`reports/${key}/export`, A);
  const headerOk = r.text.includes(EXPORT_HEADER[key]);
  ok(
    '导出',
    `GET /reports/${key}/export → CSV 流（BOM + 表头）`,
    r.status === 200 && /text\/csv/i.test(r.type) && r.hasBom && headerOk,
    `HTTP=${r.status} type=${r.type.split(';')[0]} bom=${r.hasBom} header=${headerOk} bytes=${r.bytes}`,
  );
}

// ================================================================ 3. 隔离（附属收敛到本商家）
log('———— 数据隔离 ————');

const s1Onboarding = await call('GET', 'reports/merchant-onboarding', S1);
ok(
  '隔离',
  '附属的商户入驻报表只含自己（看不到全平台）',
  s1Onboarding.status === 200 && s1Onboarding.data?.summary?.total === 1,
  `HTTP=${s1Onboarding.status} total=${s1Onboarding.data?.summary?.total}（主体=${mainTotal}）`,
);

const s1Orders = await call('GET', 'reports/orders-summary', S1);
const s1MerchantIds = [...new Set((s1Orders.data?.byMerchant ?? []).map((x) => x.merchantId))];
ok(
  '隔离',
  '附属的订单报表按商家分组只含自己',
  s1Orders.status === 200 && s1MerchantIds.every((id) => id === 2),
  `HTTP=${s1Orders.status} merchantIds=[${s1MerchantIds.join(',')}]`,
);

const s1Auth = await call('GET', 'reports/authorization-logs?page=1&pageSize=50', S1);
const s1AuthOwned = (s1Auth.data?.list ?? []).every((x) => x.mainMerchantId === 2 || x.subMerchantId === 2);
ok(
  '隔离',
  '附属的授权记录只含与自己相关的行',
  s1Auth.status === 200 && s1AuthOwned,
  `HTTP=${s1Auth.status} rows=${s1Auth.data?.list?.length ?? 0}`,
);

// 显式传别家 merchantId：应被强制收敛，不得越权
const s1Cross = await call('GET', 'reports/merchant-onboarding?merchantId=3', S1);
ok(
  '隔离',
  '附属显式传别家 merchantId → 仍只返回自己（不越权）',
  s1Cross.status === 200 && s1Cross.data?.summary?.total === 1,
  `HTTP=${s1Cross.status} total=${s1Cross.data?.summary?.total}`,
);

// 两个附属看到的订单金额互不相同（证明各自口径独立）
const s2Orders = await call('GET', 'reports/orders-summary', S2);
const s2MerchantIds = [...new Set((s2Orders.data?.byMerchant ?? []).map((x) => x.merchantId))];
ok(
  '隔离',
  '另一个附属同样只看自己的商家',
  s2Orders.status === 200 && s2MerchantIds.length > 0 && s2MerchantIds.every((id) => id === 3),
  `HTTP=${s2Orders.status} merchantIds=[${s2MerchantIds.join(',')}]`,
);

// 店员：报表收敛到本店
const ckPoints = await call('GET', 'reports/points-summary', CK);
ok('隔离', '店员可看报表（report:view）且只统计本店', ckPoints.status === 200 && !!ckPoints.data?.summary, `HTTP=${ckPoints.status}`);

// ================================================================ 4. 权限与参数校验
log('———— 权限与校验 ————');

const ckExport = await callRaw('reports/orders-summary/export', CK);
ok('权限', '店员无 report:export → 导出 403', ckExport.status === 403, `HTTP=${ckExport.status}`);

const s1Export = await callRaw('reports/orders-summary/export', S1);
ok('权限', '附属有 report:export → 导出 200 且内容只含自己', s1Export.status === 200 && s1Export.text.length > 0, `HTTP=${s1Export.status}`);

// 报表路由是 6 个具名路径（不是 :key 通配），非法 key 直接被路由层拦成 404
const badKey = await call('GET', 'reports/not-a-report', A);
ok('校验', '非法报表 key → 404（路由层拦截）', badKey.status === 404, `HTTP=${badKey.status}`);

const badExport = await callRaw('reports/not-a-report/export', A);
ok('校验', '非法 key 导出 → 400', badExport.status === 400, `HTTP=${badExport.status}`);

const noAuth = await call('GET', 'reports/orders-summary', null);
ok('校验', '未登录访问报表 → 401', noAuth.status === 401, `HTTP=${noAuth.status}`);

// 分页边界：pageSize 超上限 200 应 400（DTO 有 @Max(200)）
const badPage = await call('GET', 'reports/orders-summary?pageSize=201', A);
ok('校验', 'pageSize 超上限（201）→ 400', badPage.status === 400, `HTTP=${badPage.status}`);

log(`\n===== S4.3 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail === 0 ? 0 : 1);
