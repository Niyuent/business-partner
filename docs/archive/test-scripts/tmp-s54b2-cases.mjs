/**
 * S5.4-B2 第 3 步验收：/main/notifications（通知中心）+ 新增「某批收件人」接口
 * 真实 HTTP（http://localhost/api/v1）；结尾清理测试通知（加 --keep 保留数据供截图）。
 *
 * 覆盖：
 *  - 平台发布 → 附属收件箱可见 / 未读数 / 标记已读（每人各自已读）
 *  - 发件箱按批次聚合 + 新接口 GET /notifications/sent/:sendBatchId
 *  - 越权：非发送人查批次 404、无 notification:send 查发件箱 403、假 uuid 404
 *  - 设计约束：平台的发布目标**不含主体商家**（主体只能发、不能收）
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost/api/v1';
const ROOT_PWD = readFileSync('.env', 'utf8').match(/^MYSQL_ROOT_PASSWORD=(.+)$/m)[1].trim();
const TAG = Date.now().toString().slice(-6);
const KEEP = process.argv.includes('--keep');
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
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, data: j.data, msg: j.message, reason: j.data?.reasonCode };
}

const login = async (u) => (await call('POST', 'auth/login', null, { username: u, password: 'Test@123456' })).data?.accessToken ?? null;

function sql(statement) {
  writeFileSync('tmp-s54b2.sql', statement + '\n');
  execSync('docker compose cp tmp-s54b2.sql mysql:/tmp/s54b2x.sql', { stdio: 'pipe' });
  execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' shangmeng < /tmp/s54b2x.sql"`, { stdio: 'pipe' });
}
function scalar(s) {
  writeFileSync('tmp-s54b2.sql', s + '\n');
  execSync('docker compose cp tmp-s54b2.sql mysql:/tmp/s54b2q.sql', { stdio: 'pipe' });
  return (
    execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' -N -B shangmeng < /tmp/s54b2q.sql"`, {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')[0]
      ?.trim() ?? ''
  );
}

const okStatus = (s) => s >= 200 && s < 300;

// ---------------------------------------------------------------- 登录
const platform = await login('platform');
const sub01 = await login('sub01');
const admin = await login('admin');
ok('准备', '三个账号登录', !!(platform && sub01 && admin), `platform=${!!platform} sub01=${!!sub01} admin=${!!admin}`);

// ---------------------------------------------------------------- 1. targets（每次重新请求，不缓存）
const tg = await call('GET', 'notifications/targets', platform);
const sub2 = tg.data?.merchants?.find((m) => m.id === 2);
const store101 = tg.data?.stores?.find((s) => s.id === 101);
const store102 = tg.data?.stores?.find((s) => s.id === 102);
ok(
  'targets',
  '平台可发布目标 = 已审核附属 + 其营业中门店（不含主体商家）',
  !!sub2 && !!store101 && !!store102 && !tg.data.merchants.some((m) => m.id === 1),
  `merchants=${tg.data?.merchants?.length} stores=${tg.data?.stores?.length}`,
);

// ---------------------------------------------------------------- 2. 平台发布 3 批
const r1 = await call('POST', 'notifications', platform, {
  targetType: 'MERCHANT',
  targetIds: [2],
  title: `【S5.4-B2】附属商家通知 ${TAG}`,
  content: `这是发给附属商家的站内信，批次 ${TAG}。\n第二行：用于验证换行与全文展示。`,
  type: 'AUDIT_RESULT',
  level: 'IMPORTANT',
});
const batch1 = r1.data?.sendBatchId;
ok('发布', '发给附属商家（MERCHANT）→ 1 条', okStatus(r1.status) && r1.data?.count === 1 && !!batch1, `HTTP=${r1.status} count=${r1.data?.count}`);

const r2 = await call('POST', 'notifications', platform, {
  targetType: 'STORE',
  targetIds: [101, 102],
  title: `【S5.4-B2】门店批量通知 ${TAG}`,
  content: `一次发给 2 家门店，批次 ${TAG}。`,
  type: 'ABNORMAL_ORDER',
  level: 'URGENT',
});
const batch2 = r2.data?.sendBatchId;
ok('发布', '一次发给 2 家门店（STORE 多选）→ 2 条', okStatus(r2.status) && r2.data?.count === 2 && !!batch2, `HTTP=${r2.status} count=${r2.data?.count}`);

const r3 = await call('POST', 'notifications', platform, {
  targetType: 'ALL_MERCHANTS',
  title: `【S5.4-B2】全部附属 ${TAG}`,
  content: `全部附属广播，批次 ${TAG}。`,
  type: 'SETTLEMENT',
  level: 'NORMAL',
});
const batch3 = r3.data?.sendBatchId;
ok('发布', 'ALL_MERCHANTS 广播 → 展开为已审核附属数', okStatus(r3.status) && r3.data?.count >= 2 && !!batch3, `HTTP=${r3.status} count=${r3.data?.count}`);

const bad0 = await call('POST', 'notifications', platform, {
  targetType: 'MERCHANT',
  targetIds: [1],
  title: `【S5.4-B2】越权目标 ${TAG}`,
  content: '主体商家不在平台发布目标内',
});
ok('越权', '平台发给主体商家（非目标）→ 403', bad0.status === 403, `HTTP=${bad0.status} reason=${bad0.reason}`);

// ---------------------------------------------------------------- 3. 附属收件箱（sub01：商家级 2 条 + 门店级 2 条）
const inbox = await call('GET', 'notifications?page=1&pageSize=20', sub01);
const mine = inbox.data?.list?.find((n) => n.sendBatchId === batch1);
ok('收件箱', '附属收到本批发给自己的通知（alreadyRead=false）', !!mine && mine.alreadyRead === false, `total=${inbox.data?.total} unread=${inbox.data?.unreadCount}`);

const unreadBefore = Number((await call('GET', 'notifications/unread-count', sub01)).data?.unreadCount);
ok('收件箱', '未读数与列表附带值一致', unreadBefore === inbox.data?.unreadCount && unreadBefore >= 1, `unreadCount=${unreadBefore}`);

// ---------------------------------------------------------------- 4. 标记已读（每人各自）
const mr = await call('PATCH', `notifications/${mine.id}/read`, sub01);
ok('标记已读', 'PATCH read → alreadyRead=true', okStatus(mr.status) && mr.data?.alreadyRead === true, `HTTP=${mr.status} alreadyRead=${mr.data?.alreadyRead}`);
const mr2 = await call('PATCH', `notifications/${mine.id}/read`, sub01);
ok('标记已读', '重复标记仍成功（幂等）', okStatus(mr2.status) && mr2.data?.alreadyRead === true, `HTTP=${mr2.status}`);

const unreadAfter = Number((await call('GET', 'notifications/unread-count', sub01)).data?.unreadCount);
ok('标记已读', '未读数减 1', unreadAfter === unreadBefore - 1, `${unreadBefore} → ${unreadAfter}`);

const unreadOnly = await call('GET', 'notifications?readStatus=UNREAD&page=1&pageSize=20', sub01);
ok('标记已读', '未读筛选下已读通知不再出现', !unreadOnly.data?.list?.some((n) => n.sendBatchId === batch1), `unreadTotal=${unreadOnly.data?.total}`);

// ---------------------------------------------------------------- 5. 发件箱聚合
const sent = await call('GET', 'notifications/sent?page=1&pageSize=20', platform);
const row1 = sent.data?.list?.find((x) => x.sendBatchId === batch1);
const row2 = sent.data?.list?.find((x) => x.sendBatchId === batch2);
const row3 = sent.data?.list?.find((x) => x.sendBatchId === batch3);
ok(
  '发件箱',
  '三批各聚合成一行（receiverCount 1 / 2 / N）',
  !!row1 && row1.receiverCount === 1 && !!row2 && row2.receiverCount === 2 && !!row3 && row3.receiverCount >= 2,
  `c1=${row1?.receiverCount} c2=${row2?.receiverCount} c3=${row3?.receiverCount} total=${sent.data?.total}`,
);

// ---------------------------------------------------------------- 6. 新接口：某批收件人
const br = await call('GET', `notifications/sent/${batch2}`, platform);
ok(
  '收件人',
  '新接口返回本批 2 名门店收件人（含名称/编码/所属商家）',
  okStatus(br.status) &&
    br.data?.receivers?.length === 2 &&
    br.data.receivers.every((r) => r.receiverType === 'STORE' && !!r.name && r.merchantId === 2),
  `HTTP=${br.status} ${(br.data?.receivers ?? []).map((r) => `${r.name}#${r.code}`).join(' | ')}`,
);

const br1 = await call('GET', `notifications/sent/${batch1}`, platform);
ok(
  '收件人',
  'MERCHANT 批次返回 1 名商家收件人',
  okStatus(br1.status) && br1.data?.receivers?.length === 1 && br1.data.receivers[0].receiverType === 'MERCHANT',
  `HTTP=${br1.status} ${br1.data?.receivers?.[0]?.name}`,
);

// ---------------------------------------------------------------- 7. 负例
const bad1 = await call('GET', `notifications/sent/${batch2}`, sub01);
ok('越权', '无 notification:send 的附属查收件人 → 403（权限守卫先行）', bad1.status === 403, `HTTP=${bad1.status} reason=${bad1.reason}`);

const bad1b = await call('GET', `notifications/sent/${batch2}`, admin);
ok('越权', '有发送权但非发送人（主体）查别人批次 → 404', bad1b.status === 404, `HTTP=${bad1b.status} reason=${bad1b.reason}`);

const bad2 = await call('GET', 'notifications/sent/00000000-0000-4000-8000-000000000000', platform);
ok('越权', '不存在的 uuid → 404', bad2.status === 404, `HTTP=${bad2.status} reason=${bad2.reason}`);

const bad3 = await call('GET', 'notifications/sent', sub01);
ok('越权', '无 notification:send 的附属查发件箱 → 403', bad3.status === 403, `HTTP=${bad3.status} reason=${bad3.reason}`);

const bad4 = await call('PATCH', 'notifications/99999999/read', sub01);
ok('越权', '标记不存在/非自己接收范围的通知 → 404', bad4.status === 404, `HTTP=${bad4.status} reason=${bad4.reason}`);

// ---------------------------------------------------------------- 8. 清理
if (KEEP) {
  log('  （--keep：保留测试通知供截图）');
} else {
  sql(
    `DELETE FROM notification_reads WHERE notificationId IN (SELECT id FROM notifications WHERE title LIKE '%${TAG}%');\n` +
      `DELETE FROM notifications WHERE title LIKE '%${TAG}%';`,
  );
  const left = Number(scalar(`SELECT COUNT(*) FROM notifications WHERE title LIKE '%${TAG}%';`));
  ok('清理', '测试通知与阅读记录已删除', left === 0, `left=${left}`);
}

log(`\n结果：通过 ${pass} 条 / 失败 ${fail} 条（TAG=${TAG}${KEEP ? '，数据保留' : ''}）`);
process.exit(fail === 0 ? 0 : 1);
