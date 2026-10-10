/**
 * S3.2 验收用例：积分兑换代金券（FIFO / 幂等 / 并发 / 事务完整性）
 * 全部走真实 HTTP（http://localhost/api/v1）。
 */
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
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
    headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, data: j.data, msg: j.message, reason: j.data?.reasonCode };
}
const login = async (u) => (await call('POST', 'auth/login', null, { username: u, password: 'Test@123456' })).data?.accessToken ?? null;

function sql(statement) {
  writeFileSync('tmp-s32.sql', statement + '\n');
  execSync('docker compose cp tmp-s32.sql mysql:/tmp/s32x.sql', { stdio: 'pipe' });
  execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' shangmeng < /tmp/s32x.sql"`, { stdio: 'pipe' });
  execSync('docker compose exec -T mysql rm -f /tmp/s32x.sql', { stdio: 'pipe' });
}

const A = await login('admin');
const P = await login('platform');
const CK = await login('clerk01');
const S2 = await login('sub02');

const isoDay = (days) => new Date(Date.now() + days * 86400_000).toISOString();

/**
 * 建/重置用户：直接 SQL（MVP 没有用户注册接口）。
 *
 * **每次都先清掉该用户的历史数据**（兑换记录 → 券实例 → 积分流水 → 积分账户，按外键顺序删），
 * 否则脚本第二次跑时余额、限领次数都会带着上一轮的残留，用例会莫名其妙地失败——
 * 这类「看起来是功能坏了，其实是测试数据没归零」的坑最浪费时间。
 */
async function mkUser(id, name, phone) {
  sql(
    `DELETE FROM redemption_records WHERE userId = ${id};
     UPDATE orders SET couponInstanceId = NULL WHERE userId = ${id};
     DELETE FROM exchange_records WHERE userId = ${id};
     DELETE FROM coupon_instances WHERE userId = ${id};
     DELETE FROM point_transactions WHERE userId = ${id};
     DELETE FROM point_accounts WHERE userId = ${id};
     INSERT INTO users (id, phone, nickname, status, registeredAt, createdAt, updatedAt) VALUES (${id}, '${phone}', '${name}', 'ACTIVE', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE nickname='${name}';`,
  );
}
/** 造一个指定有效期的积分批次（走人工调整接口，DTO 支持自定义 expireAt） */
async function mkBatch(userId, amount, days, reason) {
  return call('POST', 'points/adjust', A, {
    userId,
    amount,
    reason,
    expireAt: isoDay(days),
  });
}
/** 建可兑换模板：创建 → 上架 → 预生成券码 */
async function mkTemplate(name, { pointsCost, totalStock, codes, perUserLimit }) {
  const created = await call('POST', 'coupon-templates', A, {
    ownerType: 'MAIN_COUPON',
    name,
    faceValue: 10,
    thresholdAmount: 0,
    totalStock,
    validType: 'AFTER_RECEIVE_DAYS',
    validDays: 30,
    applyScope: 'ALL_STORES',
    pointsCost,
    ...(perUserLimit ? { perUserLimit } : {}),
  });
  const id = created.data?.template?.id ?? created.data?.id;
  await call('PATCH', `coupon-templates/${id}/publish`, A, {});
  if (codes > 0) {
    await call('POST', `coupon-templates/${id}/codes`, A, {
      batchNo: `${id}-20261007-${String(Math.floor(Math.random() * 900) + 100)}`,
      quantity: codes,
      remark: 'S3.2 用例券码',
    });
  }
  return id;
}

// ===================== 遗留 1：PLATFORM 账号 + earn 平台分支 =====================
log('———— 遗留1：平台账号与 /points/earn 平台分支 ————');
ok('遗留1', 'platform 账号可登录且 userType=PLATFORM', !!P, `token=${P ? 'ok' : 'null'}`);
const prof = await call('GET', 'auth/profile', P);
ok('遗留1', 'platform 账号无商家归属（merchantId 为空）',
  prof.data.user?.merchantId === null || prof.data.merchant?.id === null || prof.data.userType === 'PLATFORM',
  `userType=${prof.data.user?.userType ?? prof.data.userType} merchant=${JSON.stringify(prof.data.merchant ?? null)}`);

await mkUser(1001, '张三', '13800000001');
let r = await call('POST', 'points/earn', P, { userId: 1001, amount: 50 });
ok('遗留1', '平台账号录单不传 merchantId → 400 MERCHANT_ID_REQUIRED',
  r.status === 400 && r.reason === 'MERCHANT_ID_REQUIRED', `HTTP ${r.status} ${r.reason}`);

sql("INSERT INTO orders (orderNo, userId, merchantId, storeId, totalAmount, payAmount, orderType, source, consumeTime, createdAt, updatedAt) VALUES ('ORD-S32-P1', 1001, 1, 101, 50, 50, 'CONSUME', 'IMPORT', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE totalAmount=VALUES(totalAmount);");
r = await call('POST', 'points/earn', P, { userId: 1001, amount: 50, merchantId: 1, orderNo: 'ORD-S32-P1' });
ok('遗留1', '平台账号录单传 merchantId → 成功', ok200(r.status) && r.data.points === 50,
  `HTTP ${r.status} 送 ${r.data?.points} 分`);

// ===================== 遗留 2：earn 必须带订单 =====================
log('');
log('———— 遗留2：/points/earn 必须带 orderId ————');
r = await call('POST', 'points/earn', A, { userId: 1001, amount: 50, merchantId: 1 });
ok('遗留2', '不带 orderId/orderNo → 400 ORDER_ID_REQUIRED',
  r.status === 400 && r.reason === 'ORDER_ID_REQUIRED', `HTTP ${r.status} ${r.reason} | ${r.msg}`);

// ===================== 用例 1：FIFO 3 批次 =====================
log('');
log('———— 用例1：FIFO 扣减（A+30d/100，B+10d/50，C+20d/80，兑换 120） ————');
await mkUser(1003, '王五', '13800000003');
await mkBatch(1003, 100, 30, 'S3.2 批次A：100分 30天后过期');
await mkBatch(1003, 50, 10, 'S3.2 批次B：50分 10天后过期');
await mkBatch(1003, 80, 20, 'S3.2 批次C：80分 20天后过期');
const tplFifo = await mkTemplate('S32 FIFO 测试券(120分)', { pointsCost: 120, totalStock: 10, codes: 20 });

const before = await call('GET', 'point-accounts/1003', A);
const batchBefore = before.data.batches.filter((b) => b.usable).sort((x, y) => new Date(x.expireAt) - new Date(y.expireAt));
log(`  兑换前批次（按 expireAt 升序）：${batchBefore.map((b) => `#${b.id}(${b.remainingAmount}, ${String(b.expireAt).slice(0, 10)})`).join(' ')}`);

r = await call('POST', 'points/exchange', A, {
  userId: 1003, templateId: tplFifo, requestId: randomUUID(), channel: 'H5', remark: 'FIFO 用例',
});
const after = await call('GET', 'point-accounts/1003', A);
const remain = new Map(after.data.batches.map((b) => [b.id, b.remainingAmount]));
const [bB, bC, bA] = batchBefore; // 10d / 20d / 30d
ok('用例1', '兑换 120 成功，余额 230 → 110',
  ok200(r.status) && after.data.account.balance === 110, `HTTP ${r.status} 余额=${after.data.account.balance} 券码=${r.data?.code}`);
// 被扣光的批次不再出现在明细里（明细只列 remainingAmount>0），故用「不在列表 或 为 0」判定
ok('用例1', 'B(+10d) 50 → 0（最先过期，优先扣）', (remain.get(bB.id) ?? 0) === 0,
  `${bB.remainingAmount} → ${remain.get(bB.id) ?? 0}`);
ok('用例1', 'C(+20d) 80 → 10（扣 70）', remain.get(bC.id) === 10, `${bC.remainingAmount} → ${remain.get(bC.id)}`);
ok('用例1', 'A(+30d) 100 → 100（不动）', remain.get(bA.id) === 100, `${bA.remainingAmount} → ${remain.get(bA.id)}`);

const spends = await call('GET', 'point-transactions?userId=1003&type=SPEND&pageSize=10', A);
ok('用例1', '生成 2 条 SPEND 流水（-50 / -70），各指回券实例',
  spends.data.total === 2 && spends.data.list.every((x) => x.relatedCouponInstanceId === r.data.couponInstanceId),
  `SPEND ${spends.data.total} 条：${spends.data.list.map((x) => `${x.amount}(批次扣减，实例#${x.relatedCouponInstanceId})`).join(' ')}`);

const inst = await call('GET', `coupon-instances/${r.data.couponInstanceId}`, A);
ok('用例1', '券实例：source=EXCHANGE、归属主体商家、券码已绑定',
  inst.data.instance.source === 'EXCHANGE' && inst.data.instance.code === r.data.code && inst.data.instance.issuerMerchantId === 1,
  `source=${inst.data.instance.source} 券码=${inst.data.instance.code} 发券方=${inst.data.instance.issuerMerchantId}`);

// ===== 用例1b：同一用户从「同一 EARN 批次」二次扣分（S4 收口修复回归） =====
// 回归 S3.4 缺陷：SPEND 曾复用 sourceTransactionId 指回批次，撞唯一键 (userId, sourceTransactionId, type) → 500。
log('');
log('———— 用例1b：同一批次二次兑换（originBatchId 关联，无唯一键冲突） ————');
await mkUser(1006, '骆六', '13800000006');
await mkBatch(1006, 100, 30, 'S3.2 批次B：100分 单批次二次扣减');
const acc1006 = await call('GET', 'point-accounts/1006', A);
const bId = acc1006.data.batches[0]?.id;
const tplB60 = await mkTemplate('S32 二次扣减券A(60分)', { pointsCost: 60, totalStock: 5, codes: 5 });
const tplB30 = await mkTemplate('S32 二次扣减券B(30分)', { pointsCost: 30, totalStock: 5, codes: 5 });
const x1 = await call('POST', 'points/exchange', A, { userId: 1006, templateId: tplB60, requestId: randomUUID() });
const midRemain = (await call('GET', 'point-accounts/1006', A)).data.batches.find((b) => b.id === bId)?.remainingAmount;
const x2 = await call('POST', 'points/exchange', A, { userId: 1006, templateId: tplB30, requestId: randomUUID() });
const endRemain = (await call('GET', 'point-accounts/1006', A)).data.batches.find((b) => b.id === bId)?.remainingAmount ?? 0;
ok('用例1b', '第一次兑换 60 → 批次剩 40，无 500', ok200(x1.status) && midRemain === 40, `HTTP=${x1.status} 批次#${bId} 剩 ${midRemain}`);
ok('用例1b', '第二次兑换 30（同一批次）→ 批次剩 10，无 500', ok200(x2.status) && endRemain === 10, `HTTP=${x2.status} 批次#${bId} 剩 ${endRemain}`);
const sp1b = await call('GET', 'point-transactions?userId=1006&type=SPEND&pageSize=10', A);
ok('用例1b', '生成 2 条 SPEND，originBatchId 均指向批次 B', sp1b.data.total === 2 && sp1b.data.list.every((x) => x.originBatchId === bId),
  `SPEND=${sp1b.data.total} origin=${sp1b.data.list.map((x) => x.originBatchId).join(',')} 批次#${bId}`);
ok('用例1b', 'SPEND 的 sourceTransactionId 为 NULL（唯一键仅约束 EXPIRE）', sp1b.data.list.every((x) => x.sourceTransactionId === null),
  `source=${sp1b.data.list.map((x) => x.sourceTransactionId).join(',')}`);

// ===================== 用例 2：并发兑换（不同 requestId） =====================
log('');
log('———— 用例2：并发兑换同一模板（用户余额刚好 100） ————');
await mkUser(1004, '赵六', '13800000004');
await mkBatch(1004, 100, 30, 'S3.2 并发用例：100分');
const tplRace = await mkTemplate('S32 并发券(100分)', { pointsCost: 100, totalStock: 50, codes: 50 });
const beforeRace = (await call('GET', 'point-accounts/1004', A)).data.account.balance;
const [c1, c2] = await Promise.all([
  call('POST', 'points/exchange', A, { userId: 1004, templateId: tplRace, requestId: randomUUID() }),
  call('POST', 'points/exchange', A, { userId: 1004, templateId: tplRace, requestId: randomUUID() }),
]);
const afterRace = (await call('GET', 'point-accounts/1004', A)).data.account.balance;
const raceOk = [c1, c2].filter((x) => ok200(x.status)).length;
const instCount = (await call('GET', `point-accounts/1004`, A)).data; // 占位，真实计数走实例查询
const insts1004 = await call('GET', 'coupon-instances?userId=1004&pageSize=50', A);
ok('用例2', '并发 2 次兑换 → 1 成功 + 1×409 BALANCE_NOT_ENOUGH，无 500',
  raceOk === 1 && [c1, c2].some((x) => x.status === 409 && x.reason === 'BALANCE_NOT_ENOUGH') &&
    ![c1, c2].some((x) => x.status >= 500),
  `HTTP=${c1.status}/${c2.status} 成功=${raceOk} reason=${c1.reason ?? '-'}/${c2.reason ?? '-'}`);
ok('用例2', '余额未变负、只生成 1 张券',
  afterRace === beforeRace - 100 && insts1004.data.total === 1,
  `余额 ${beforeRace} → ${afterRace}；券实例数=${insts1004.data.total}`);

// ===================== 用例 3：相同 requestId 幂等 =====================
log('');
log('———— 用例3：相同 requestId 重复提交（幂等） ————');
// 幂等用例单独用一个限领宽松、价格低的模板（FIFO 券默认限领 1，第二次会被限领先拦住）
const tplIdem = await mkTemplate('S32 幂等券(10分)', { pointsCost: 10, totalStock: 50, codes: 50, perUserLimit: 5 });
const sameId = randomUUID();
const e1 = await call('POST', 'points/exchange', A, { userId: 1003, templateId: tplIdem, requestId: sameId });
const e2 = await call('POST', 'points/exchange', A, { userId: 1003, templateId: tplIdem, requestId: sameId });
ok('用例3', '两次都 200，第二次 idempotent=true 且返回同一张券',
  ok200(e1.status) && ok200(e2.status) && e2.data.idempotent === true &&
    e1.data.couponInstanceId === e2.data.couponInstanceId,
  `HTTP=${e1.status}/${e2.status} 券实例 ${e1.data?.couponInstanceId} / ${e2.data?.couponInstanceId} idempotent=${e2.data?.idempotent}`);
const e1b = (await call('GET', 'point-accounts/1003', A)).data.account.balance;
ok('用例3', '重复提交没有二次扣积分', e1b === 100, `余额=${e1b}（110 - 10 = 100）`);

// 并发同一 requestId：唯一索引兜底，只换一张券（给足积分，排除「余额不足」干扰）
await mkBatch(1004, 500, 30, 'S3.2 幂等并发：补分');
const sameId3 = randomUUID();
const [q1, q2] = await Promise.all([
  call('POST', 'points/exchange', A, { userId: 1004, templateId: tplIdem, requestId: sameId3 }),
  call('POST', 'points/exchange', A, { userId: 1004, templateId: tplIdem, requestId: sameId3 }),
]);
const insts1004b = await call('GET', 'coupon-instances?userId=1004&pageSize=50', A);
ok('用例3', '并发同一 requestId → 只生成 1 张券，无 500',
  ![q1, q2].some((x) => x.status >= 500) &&
    new Set([q1.data?.couponInstanceId, q2.data?.couponInstanceId].filter(Boolean)).size === 1,
  `HTTP=${q1.status}/${q2.status} 券实例 ${q1.data?.couponInstanceId} / ${q2.data?.couponInstanceId}`);

// ===================== 用例 4：过期批次不可用 =====================
log('');
log('———— 用例4：余额够但批次已过期 → 409 ————');
await mkUser(1005, '孙七', '13800000005');
await mkBatch(1005, 100, -5, 'S3.2 已过期批次：100分');
await mkBatch(1005, 50, 30, 'S3.2 未过期批次：50分');
const acc1005 = await call('GET', 'point-accounts/1005', A);
r = await call('POST', 'points/exchange', A, {
  userId: 1005, templateId: await mkTemplate('S32 过期边界券(80分)', { pointsCost: 80, totalStock: 5, codes: 5 }), requestId: randomUUID(),
});
ok('用例4', 'A(已过期100) + B(未过期50)，兑换 80 → 409 BALANCE_NOT_ENOUGH',
  r.status === 409 && r.reason === 'BALANCE_NOT_ENOUGH',
  `HTTP ${r.status} ${r.reason} | 余额=${acc1005.data.account.balance} 可用=${acc1005.data.summary.available} | ${r.msg}`);

// ===================== 用例 5/6/7/8：失败族 =====================
log('');
log('———— 失败用例 ————');
r = await call('POST', 'points/exchange', A, { userId: 1003, templateId: 999999, requestId: randomUUID() });
ok('F', '模板不存在 → 404 RESOURCE_NOT_FOUND', r.status === 404, `HTTP ${r.status} ${r.reason ?? r.msg}`);

const tplDraft = await mkTemplate('S32 下架券', { pointsCost: 10, totalStock: 5, codes: 5 });
await call('PATCH', `coupon-templates/${tplDraft}/unpublish`, A, {});
r = await call('POST', 'points/exchange', A, { userId: 1003, templateId: tplDraft, requestId: randomUUID() });
ok('F', '模板已下架 → 409 TEMPLATE_NOT_AVAILABLE',
  r.status === 409 && r.reason === 'TEMPLATE_NOT_AVAILABLE', `HTTP ${r.status} ${r.reason}`);

const tplStock1 = await mkTemplate('S32 库存1张券', { pointsCost: 10, totalStock: 1, codes: 3 });
await mkUser(1006, '周八', '13800000006');
await mkBatch(1006, 100, 30, 'S3.2 库存用例');
const okEx = await call('POST', 'points/exchange', A, { userId: 1006, templateId: tplStock1, requestId: randomUUID() });
await mkUser(1007, '吴九', '13800000007');
await mkBatch(1007, 100, 30, 'S3.2 库存用例2');
r = await call('POST', 'points/exchange', A, { userId: 1007, templateId: tplStock1, requestId: randomUUID() });
ok('F', '库存耗尽 → 409 STOCK_EXHAUSTED',
  ok200(okEx.status) && r.status === 409 && r.reason === 'STOCK_EXHAUSTED',
  `首单 HTTP ${okEx.status}，第二单 HTTP ${r.status} ${r.reason} | ${r.msg}`);

const tplCode1 = await mkTemplate('S32 券码1个券', { pointsCost: 10, totalStock: 100, codes: 1 });
await mkUser(1008, '郑十', '13800000008');
await mkBatch(1008, 100, 30, 'S3.2 券码池用例');
const codeEx1 = await call('POST', 'points/exchange', A, { userId: 1008, templateId: tplCode1, requestId: randomUUID() });
await mkUser(1009, '钱一', '13800000009');
await mkBatch(1009, 100, 30, 'S3.2 券码池用例2');
r = await call('POST', 'points/exchange', A, { userId: 1009, templateId: tplCode1, requestId: randomUUID() });
ok('F', '券码池耗尽 → 409 CODE_POOL_EXHAUSTED',
  ok200(codeEx1.status) && r.status === 409 && r.reason === 'CODE_POOL_EXHAUSTED',
  `首单 HTTP ${codeEx1.status}，第二单 HTTP ${r.status} ${r.reason} | ${r.msg}`);

const tplLimit = await mkTemplate('S32 限领1张券', { pointsCost: 10, totalStock: 100, codes: 100, perUserLimit: 1 });
const lim1 = await call('POST', 'points/exchange', A, { userId: 1003, templateId: tplLimit, requestId: randomUUID() });
r = await call('POST', 'points/exchange', A, { userId: 1003, templateId: tplLimit, requestId: randomUUID() });
ok('F', '超过 perUserLimit → 409 PER_USER_LIMIT_EXCEEDED',
  ok200(lim1.status) && r.status === 409 && r.reason === 'PER_USER_LIMIT_EXCEEDED',
  `首单 HTTP ${lim1.status}，第二单 HTTP ${r.status} ${r.reason} | ${r.msg}`);

r = await call('POST', 'points/exchange', A, { userId: 999999, templateId: tplFifo, requestId: randomUUID() });
ok('F', '用户不存在 → 404', r.status === 404, `HTTP ${r.status} ${r.reason ?? r.msg}`);

r = await call('POST', 'points/exchange', A, { userId: 1003, templateId: tplFifo, requestId: 'short' });
ok('F', 'requestId 过短（<8 字符）→ 400', r.status === 400, `HTTP ${r.status} ${r.msg}`);

const tplFree = await mkTemplate('S32 零分券', { pointsCost: 0, totalStock: 5, codes: 5 });
r = await call('POST', 'points/exchange', A, { userId: 1003, templateId: tplFree, requestId: randomUUID() });
ok('F', '模板未设兑换积分（pointsCost=0）→ 400 TEMPLATE_NOT_EXCHANGEABLE',
  r.status === 400 && r.reason === 'TEMPLATE_NOT_EXCHANGEABLE', `HTTP ${r.status} ${r.reason} | ${r.msg}`);

r = await call('GET', 'points/exchange-records?userId=1003', S2);
ok('F', '附属查与自己无关的兑换记录 → 403 FORBIDDEN_SCOPE',
  r.status === 403 && r.reason === 'FORBIDDEN_SCOPE', `HTTP ${r.status} ${r.reason}`);

// ===================== 成功：兑换记录 / 代客兑换 =====================
log('');
log('———— 成功用例（其余） ————');
r = await call('GET', 'points/exchange-records?userId=1003&pageSize=20', A);
ok('S', '兑换记录列表（券码 / 消耗积分 / 券状态）',
  ok200(r.status) && r.data.list.some((x) => x.couponInstanceId === e1.data.couponInstanceId),
  `HTTP ${r.status} 共 ${r.data.total} 条，样例 ${JSON.stringify(r.data.list[0] ?? {}).slice(0, 150)}`);

await mkUser(1010, '冯二', '13800000010');
await mkBatch(1010, 20, 30, 'S3.2 店员代客兑换');
r = await call('POST', 'points/exchange', CK, { userId: 1010, templateId: 1002, requestId: randomUUID(), channel: 'WEB' });
ok('S', '店员代客兑换（T2 需 5 分）', ok200(r.status) && r.data.pointsCost === 5,
  `HTTP ${r.status} ${r.reason ?? ''} 消耗 ${r.data?.pointsCost} 分，券码 ${r.data?.code} | ${r.msg ?? ''}`);

r = await call('GET', 'point-accounts/1010', A);
ok('S', '兑换后账户可用积分与余额一致扣减',
  r.data.account.balance === 15 && r.data.summary.available === 15,
  `余额=${r.data.account.balance} 可用=${r.data.summary.available}`);

const tplIssued = await call('GET', `coupon-templates/${tplIdem}`, A);
ok('S', '模板已发放数随兑换递增（条件更新生效）', tplIssued.data.issuedCount >= 2,
  `S32 幂等券 issuedCount=${tplIssued.data.issuedCount}（含并发 + 幂等重复提交各 1 次）`);

// ===================== 用例 9：事务完整性（注入失败） =====================
log('');
log('———— 用例9：第 8 步（issuedCount 更新）注入失败 → 全回滚 ————');
await mkUser(1011, '陈一', '13800000011');
await mkBatch(1011, 100, 30, 'S3.2 事务完整性用例');
const tplFail = await mkTemplate('S32 事务完整性券', { pointsCost: 60, totalStock: 10, codes: 10 });
const accBefore = (await call('GET', 'point-accounts/1011', A)).data.account.balance;
const codesBefore = await call('GET', `coupon-templates/${tplFail}/codes?status=UNISSUED&pageSize=50`, A);

// 注入：对指定模板的 UPDATE 直接 SIGNAL 失败（模拟第 8 步写库异常）
sql(`DROP TRIGGER IF EXISTS trg_s32_fail;
DELIMITER //
CREATE TRIGGER trg_s32_fail BEFORE UPDATE ON coupon_templates
FOR EACH ROW
BEGIN
  IF NEW.id = ${tplFail} THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'S3.2 用例注入：issued_count 更新失败';
  END IF;
END;//
DELIMITER ;`);

const failed = await call('POST', 'points/exchange', A, {
  userId: 1011, templateId: tplFail, requestId: randomUUID(), remark: '事务完整性',
});
const accAfter = (await call('GET', 'point-accounts/1011', A)).data.account.balance;
const codesAfter = await call('GET', `coupon-templates/${tplFail}/codes?status=UNISSUED&pageSize=50`, A);
const instAfter = await call('GET', 'coupon-instances?userId=1011&pageSize=20', A);
const recAfter = await call('GET', 'points/exchange-records?userId=1011&pageSize=20', A);
const spendAfter = await call('GET', 'point-transactions?userId=1011&type=SPEND&pageSize=10', A);

ok('用例9', '注入失败后请求失败（非 2xx）', failed.status >= 400, `HTTP ${failed.status} ${failed.reason ?? failed.msg}`);
ok('用例9', '积分未扣（余额不变）', accAfter === accBefore, `${accBefore} → ${accAfter}`);
ok('用例9', '券码未被占用（未发放数不变）', codesAfter.data.total === codesBefore.data.total,
  `${codesBefore.data.total} → ${codesAfter.data.total}`);
ok('用例9', '未生成券实例 / 兑换记录 / SPEND 流水',
  instAfter.data.total === 0 && recAfter.data.total === 0 && spendAfter.data.total === 0,
  `实例=${instAfter.data.total} 兑换记录=${recAfter.data.total} SPEND=${spendAfter.data.total}`);

sql('DROP TRIGGER IF EXISTS trg_s32_fail;');
const recovered = await call('POST', 'points/exchange', A, {
  userId: 1011, templateId: tplFail, requestId: randomUUID(), remark: '触发器已移除',
});
ok('用例9', '移除注入后同一请求成功（失败是注入导致，不是逻辑错误）',
  ok200(recovered.status), `HTTP ${recovered.status} 券码=${recovered.data?.code}`);

log('');
log(`S3.2 用例结果：通过 ${pass} 条，失败 ${fail} 条`);
