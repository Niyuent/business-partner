/**
 * S7 验收用例：SSE 实时通知（替换铃铛 60s 轮询）
 *
 * 覆盖：
 *  1. ticket 签发（JWT）→ 建立 EventSource 等价连接 → 收到 connected 握手
 *  2. 发布商家级（MERCHANT）通知 → 该商家**管理员 + 门店店员**都实时收到 notification:new
 *  3. 发布门店级（STORE）通知 → 仅**该门店店员** + 该商家管理员收到（同商家其它门店不误伤）
 *  4. 跨商家隔离：别家商家/店员收不到
 *  5. 实时性：发送 → 收到 < 2s
 *  6. 无效 ticket → 403
 *
 * 真实 HTTP：用 fetch 读 event-stream（与浏览器 EventSource 同为 text/event-stream 解析）。
 * 结尾清理本脚本创建的通知。
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost/api/v1';
const ENV = readFileSync('.env', 'utf8');
const ROOT_PWD = ENV.match(/^MYSQL_ROOT_PASSWORD=(.+)$/m)[1].trim();
const API_TOKEN = ENV.match(/^API_TOKEN=(.+)$/m)?.[1]?.trim() ?? 'please-change-api-token';
const TAG = Date.now().toString().slice(-6);
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

const login = async (u) =>
  (await call('POST', 'auth/login', null, { username: u, password: 'Test@123456' })).data?.accessToken ?? null;

function sql(statement) {
  writeFileSync('tmp-s7.sql', statement + '\n');
  execSync('docker compose cp tmp-s7.sql mysql:/tmp/s7x.sql', { stdio: 'pipe' });
  execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' shangmeng < /tmp/s7x.sql"`, { stdio: 'pipe' });
}

/** 解析一个 SSE 帧（`event: x\ndata: {...}`），忽略 `:` 开头的注释帧 */
function parseFrame(raw) {
  const lines = raw.split('\n');
  let event = 'message';
  const data = [];
  for (const line of lines) {
    if (line.startsWith(':')) return null; // 心跳
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trim());
  }
  if (!data.length) return null;
  let parsed = null;
  try {
    parsed = JSON.parse(data.join('\n'));
  } catch {
    parsed = data.join('\n');
  }
  return { event, data: parsed };
}

/** 建立 SSE 连接，后台持续读流并把事件推进数组 */
async function openSse(token) {
  const t = await call('POST', 'sse/ticket', token);
  if (!t.data?.ticket) return { error: `ticket 获取失败 HTTP=${t.status}` };

  const res = await fetch(`${BASE}/sse/notifications?ticket=${t.data.ticket}`);
  const events = [];
  let closed = false;

  if (res.status !== 200) return { status: res.status, ticket: t.data.ticket, events };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  (async () => {
    try {
      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const frame = parseFrame(buffer.slice(0, idx));
          buffer = buffer.slice(idx + 2);
          if (frame) events.push({ ...frame, at: Date.now() });
        }
      }
    } catch {
      /* 主动关闭 */
    }
  })();

  return {
    status: res.status,
    contentType: res.headers.get('content-type') ?? '',
    ticket: t.data.ticket,
    connectUrl: t.data.connectUrl,
    events,
    close: () => {
      closed = true;
      reader.cancel().catch(() => undefined);
    },
  };
}

/** 等到某个事件出现（或超时） */
async function waitFor(client, eventName, timeoutMs = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const hit = client.events.find((e) => e.event === eventName);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

const countEvent = (client, eventName) => client.events.filter((e) => e.event === eventName).length;

/**
 * 等到某事件累计到 expect 条（返回耗时 ms，超时返回 -1）
 *
 * 不能用「找到该事件的第一个」来判断：同一连接上可能已有更早的同名事件，
 * 那样会立即返回旧事件、断言时新推送还没到达 —— 假失败。
 */
async function waitCount(client, eventName, expect, timeoutMs = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (countEvent(client, eventName) >= expect) return Date.now() - started;
    await new Promise((r) => setTimeout(r, 30));
  }
  return -1;
}

// ---------------------------------------------------------------- 登录 & 建连
const admin = await login('admin'); // 主体 merchantId=1
const sub01 = await login('sub01'); // 附属 merchantId=2
const sub02 = await login('sub02'); // 附属 merchantId=3
const clerk01 = await login('clerk01'); // 店员 storeId=101, merchantId=2
ok('准备', '四个账号登录', !!(admin && sub01 && sub02 && clerk01), 'admin/sub01/sub02/clerk01');

const cSub01 = await openSse(sub01);
const cSub02 = await openSse(sub02);
const cClerk01 = await openSse(clerk01);

ok(
  '连接',
  'ticket 换流成功（text/event-stream）',
  cSub01.status === 200 && /text\/event-stream/.test(cSub01.contentType),
  `HTTP=${cSub01.status} type=${cSub01.contentType.split(';')[0]} url=${cSub01.connectUrl}`,
);
ok('连接', '连接后收到 connected 握手', !!(await waitFor(cSub01, 'connected', 2000)), `events=${cSub01.events.map((e) => e.event).join(',')}`);

// ---------------------------------------------------------------- 商家级通知（MERCHANT 2）
const beforeSub01 = countEvent(cSub01, 'notification:new');
const beforeClerk = countEvent(cClerk01, 'notification:new');
const beforeSub02 = countEvent(cSub02, 'notification:new');

const t0 = Date.now();
const send1 = await call('POST', 'notifications', admin, {
  targetType: 'MERCHANT',
  targetIds: [2],
  title: `【S7】商家级推送 ${TAG}`,
  content: 'SSE 实时推送验证：商家级通知',
  type: 'SYSTEM',
  level: 'IMPORTANT',
});
const evtSub01 = await waitFor(cSub01, 'notification:new', 2000);
const latency = evtSub01 ? evtSub01.at - t0 : -1;

ok('推送', '发布 MERCHANT 2 通知 → 201', send1.status === 201, `HTTP=${send1.status} count=${send1.data?.count}`);
ok(
  '推送',
  '商家管理员（sub01）实时收到 notification:new',
  !!evtSub01 && countEvent(cSub01, 'notification:new') === beforeSub01 + 1,
  `延迟=${latency}ms title=${evtSub01?.data?.title ?? '-'}`,
);
ok(
  '推送',
  'payload 字段齐全（id/title/content/level/type/createdAt）',
  !!evtSub01 &&
    typeof evtSub01.data?.id === 'number' &&
    !!evtSub01.data?.title &&
    !!evtSub01.data?.content &&
    !!evtSub01.data?.level &&
    !!evtSub01.data?.type &&
    !!evtSub01.data?.createdAt,
  JSON.stringify(evtSub01?.data ?? {}).slice(0, 120),
);
ok('推送', '实时性 < 2s', latency >= 0 && latency < 2000, `${latency}ms`);
ok(
  '推送',
  '同商家门店店员（clerk01）也收到商家级通知',
  countEvent(cClerk01, 'notification:new') === beforeClerk + 1,
  `clerk01 events=${countEvent(cClerk01, 'notification:new')}`,
);
ok(
  '隔离',
  '别家商家（sub02, merchantId=3）收不到',
  countEvent(cSub02, 'notification:new') === beforeSub02,
  `sub02 events=${countEvent(cSub02, 'notification:new')}`,
);

// ---------------------------------------------------------------- 门店级通知（STORE 101）
const beforeStoreClerk = countEvent(cClerk01, 'notification:new');
const beforeStoreSub01 = countEvent(cSub01, 'notification:new');
const beforeStoreSub02 = countEvent(cSub02, 'notification:new');

const send2 = await call('POST', 'notifications', admin, {
  targetType: 'STORE',
  targetIds: [101],
  title: `【S7】门店级推送 ${TAG}`,
  content: 'SSE 实时推送验证：仅门店 101 的店员 + 商家管理员',
  type: 'ABNORMAL_ORDER',
  level: 'URGENT',
});
const clerkWait = await waitCount(cClerk01, 'notification:new', beforeStoreClerk + 1);
const sub01Wait = await waitCount(cSub01, 'notification:new', beforeStoreSub01 + 1);

ok('推送', '发布 STORE 101 通知 → 201', send2.status === 201, `HTTP=${send2.status} count=${send2.data?.count}`);
ok(
  '推送',
  '该门店店员（clerk01）实时收到',
  clerkWait >= 0 && countEvent(cClerk01, 'notification:new') === beforeStoreClerk + 1,
  `延迟=${clerkWait}ms events=${countEvent(cClerk01, 'notification:new')}`,
);
ok(
  '推送',
  '该商家管理员（sub01）也收到（管理员可看旗下所有门店通知）',
  sub01Wait >= 0 && countEvent(cSub01, 'notification:new') === beforeStoreSub01 + 1,
  `延迟=${sub01Wait}ms events=${countEvent(cSub01, 'notification:new')}`,
);
ok(
  '隔离',
  '别家商家（sub02）仍收不到',
  countEvent(cSub02, 'notification:new') === beforeStoreSub02,
  `sub02 events=${countEvent(cSub02, 'notification:new')}`,
);

// ---------------------------------------------------------------- ticket 校验
const bad = await fetch(`${BASE}/sse/notifications?ticket=not-a-real-ticket`);
ok('校验', '无效 ticket → 403', bad.status === 403, `HTTP=${bad.status}`);

const noTicket = await fetch(`${BASE}/sse/notifications`);
ok('校验', '不带 ticket → 403', noTicket.status === 403, `HTTP=${noTicket.status}`);

// ---------------------------------------------------------------- 统计（连接数）
const stats = await fetch(`${BASE}/sse/stats?token=${API_TOKEN}`)
  .then((r) => (r.status === 200 ? r.json() : null))
  .catch(() => null);
ok(
  '连接',
  '当前至少 3 条在线连接（sub01/sub02/clerk01）',
  !!stats && (stats.data?.connections ?? 0) >= 3,
  `connections=${stats?.data?.connections ?? '?'}`,
);

// ---------------------------------------------------------------- 清理
cSub01.close();
cSub02.close();
cClerk01.close();
sql(`DELETE FROM notification_reads WHERE notificationId IN (SELECT id FROM notifications WHERE title LIKE '%${TAG}%');`);
sql(`DELETE FROM notifications WHERE title LIKE '%${TAG}%';`);
log('  （已断开连接并清理测试通知）');

log(`\n===== S7 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail === 0 ? 0 : 1);
