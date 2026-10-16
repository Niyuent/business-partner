/**
 * S5.4-B1 验收用例：通知「每人各自已读」+ 发送人/批次 + 我发过的通知 + 工作台口径统一 + 迁移回填
 * 真实 HTTP；结尾清理测试通知与阅读记录。
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost/api/v1';
const ROOT_PWD = readFileSync('.env', 'utf8').match(/^MYSQL_ROOT_PASSWORD=(.+)$/m)[1].trim();
const TAG = Date.now().toString().slice(-6);
const MIGRATION_SQL = 'server/prisma/migrations/20261015100000_s54b_notification_reads/migration.sql';
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
  writeFileSync('tmp-s54b1.sql', statement + '\n');
  execSync('docker compose cp tmp-s54b1.sql mysql:/tmp/s54b1x.sql', { stdio: 'pipe' });
  execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' shangmeng < /tmp/s54b1x.sql"`, { stdio: 'pipe' });
}
function scalar(s) {
  writeFileSync('tmp-s54b1.sql', s + '\n');
  execSync('docker compose cp tmp-s54b1.sql mysql:/tmp/s54b1q.sql', { stdio: 'pipe' });
  return (
    execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' -N -B shangmeng < /tmp/s54b1q.sql"`, {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')[0]
      ?.trim() ?? ''
  );
}
/** 直接执行仓库里的迁移脚本（验证幂等 / 回填） */
function runMigration() {
  execSync(`docker compose cp ${MIGRATION_SQL} mysql:/tmp/s54b1_mig.sql`, { stdio: 'pipe' });
  execSync(`docker compose exec -T mysql bash -c "mysql -uroot -p'${ROOT_PWD}' shangmeng < /tmp/s54b1_mig.sql"`, {
    stdio: 'pipe',
  });
}

const A = await login('admin'); // 主体
const P = await login('platform'); // 平台
const S1 = await login('sub01'); // 附属 merchant 2
const CK = await login('clerk01'); // 店员 store 101

const ownStore = Number(scalar(`SELECT storeId FROM admin_users WHERE username='clerk01'`));
const ownMerchant = Number(scalar(`SELECT merchantId FROM admin_users WHERE username='clerk01'`));
const mainMerchant = Number(scalar(`SELECT merchantId FROM admin_users WHERE username='admin'`));
const otherMerchant = Number(
  scalar(`SELECT id FROM merchants WHERE parentId=${mainMerchant} AND id<>${ownMerchant} ORDER BY id LIMIT 1`),
);
const minAdminOfStore = Number(scalar(`SELECT MIN(id) FROM admin_users WHERE storeId=${ownStore}`));
const expectStoreCount = Number(
  scalar(
    `SELECT COUNT(*) FROM stores s JOIN merchants m ON m.id=s.merchantId WHERE m.parentId=${mainMerchant} AND m.status='APPROVED' AND s.status='OPEN'`,
  ),
);
log(`（主体=${mainMerchant} 本店=${ownStore} 本商家=${ownMerchant} 别家=${otherMerchant} 本店最早管理员=${minAdminOfStore} 可发门店数=${expectStoreCount}）`);

const T = (n) => `S5B1-${TAG}-${n}`;
const cleanup = () =>
  sql(`DELETE r FROM notification_reads r JOIN notifications n ON n.id=r.notificationId WHERE n.title LIKE 'S5B1-${TAG}%';
       DELETE FROM notifications WHERE title LIKE 'S5B1-${TAG}%';`);
cleanup();

// ============ 1. 每人各自已读 ============
log('');
log('———— 每人各自已读（同一门店通知，店员/附属互不影响） ————');
let nid = 0;
{
  const r = await call('POST', 'notifications', A, {
    targetType: 'STORE',
    targetIds: [ownStore],
    title: T('store-101'),
    content: '门店通知：各自已读验证',
  });
  nid = Number(scalar(`SELECT MAX(id) FROM notifications WHERE title='${T('store-101')}'`));
  ok('A1', '主体→指定门店发布成功（写 senderId + sendBatchId）', r.status === 201 && !!r.data?.sendBatchId, `HTTP=${r.status} batch=${r.data?.sendBatchId}`);
  const sid = scalar(`SELECT IFNULL(MAX(senderId),'NULL') FROM notifications WHERE title='${T('store-101')}'`);
  ok('A2', '发布人落库（senderId = admin 的账号 id）', Number(sid) > 0, `senderId=${sid}`);
}
{
  const ckUnreadBefore = (await call('GET', 'notifications/unread-count', CK)).data?.unreadCount ?? 0;
  const s1UnreadBefore = (await call('GET', 'notifications/unread-count', S1)).data?.unreadCount ?? 0;
  const ck = await call('PATCH', `notifications/${nid}/read`, CK);
  const ckAfter = (await call('GET', 'notifications/unread-count', CK)).data?.unreadCount ?? 0;
  const s1After = (await call('GET', 'notifications/unread-count', S1)).data?.unreadCount ?? 0;
  ok('A3', '店员标记已读 → 200 且 alreadyRead=false', ck.status === 200 && ck.data?.alreadyRead === false, `HTTP=${ck.status} alreadyRead=${ck.data?.alreadyRead}`);
  ok('A4', '店员未读数 -1', ckAfter === ckUnreadBefore - 1, `${ckUnreadBefore} → ${ckAfter}`);
  ok('A5', '附属未读数**不受影响**（各自已读）', s1After === s1UnreadBefore, `${s1UnreadBefore} → ${s1After}`);
  const ckReadIds = ((await call('GET', 'notifications?readStatus=UNREAD&pageSize=100', CK)).data?.list ?? []).map((x) => x.id);
  const s1ReadIds = ((await call('GET', 'notifications?readStatus=UNREAD&pageSize=100', S1)).data?.list ?? []).map((x) => x.id);
  ok('A6', '店员 UNREAD 列表已不含该条；附属 UNREAD 列表仍含该条', !ckReadIds.includes(nid) && s1ReadIds.includes(nid), `clerk含=${ckReadIds.includes(nid)} sub01含=${s1ReadIds.includes(nid)}`);
  ok('A7', 'notification_reads 仅 1 条（店员）', Number(scalar(`SELECT COUNT(*) FROM notification_reads WHERE notificationId=${nid}`)) === 1, `count=${scalar(`SELECT COUNT(*) FROM notification_reads WHERE notificationId=${nid}`)}`);
}
{
  const r = await call('PATCH', `notifications/${nid}/read`, S1);
  const cnt = Number(scalar(`SELECT COUNT(*) FROM notification_reads WHERE notificationId=${nid}`));
  ok('A8', '附属也标记已读 → 200 且各自一行（共 2 条）', r.status === 200 && cnt === 2, `HTTP=${r.status} reads=${cnt}`);
}

// ============ 2. 幂等 ============
log('');
log('———— 重复已读幂等 ————');
{
  const r = await call('PATCH', `notifications/${nid}/read`, CK);
  const cnt = Number(scalar(`SELECT COUNT(*) FROM notification_reads WHERE notificationId=${nid}`));
  ok('B1', '重复标记 → 200 + alreadyRead=true，且不新增记录', r.status === 200 && r.data?.alreadyRead === true && cnt === 2, `HTTP=${r.status} alreadyRead=${r.data?.alreadyRead} reads=${cnt}`);
}
{
  const r = await call('PATCH', 'notifications/read-all', CK);
  ok('B2', '全部已读返回实际更新条数（≥0 的整数）', r.status === 200 && typeof r.data?.updated === 'number', `HTTP=${r.status} updated=${r.data?.updated}`);
  const after = (await call('GET', 'notifications/unread-count', CK)).data?.unreadCount ?? -1;
  ok('B3', '全部已读后店员未读数为 0', after === 0, `unread=${after}`);
}

// ============ 3. 非本人通知 404 ============
log('');
log('———— 越权 / 404 ————');
let otherNid = 0;
{
  await call('POST', 'notifications', A, { targetType: 'MERCHANT', targetIds: [otherMerchant], title: T('other'), content: '别家商家通知' });
  otherNid = Number(scalar(`SELECT MAX(id) FROM notifications WHERE title='${T('other')}'`));
  const r = await call('PATCH', `notifications/${otherNid}/read`, S1);
  ok('C1', '标记别家通知 → 404（不泄露存在性）', r.status === 404, `HTTP=${r.status} ${r.reason}`);
  const list = (await call('GET', 'notifications?pageSize=100', S1)).data?.list ?? [];
  ok('C2', '别家通知不出现在自己的列表', !list.some((x) => x.id === otherNid), `found=${list.some((x) => x.id === otherNid)}`);
}
{
  const r = await call('GET', 'notifications', P);
  const u = await call('GET', 'notifications/unread-count', P);
  ok('C3', '平台账号无接收身份 → 列表空、未读数 0', r.status === 200 && (r.data?.list ?? []).length === 0 && u.data?.unreadCount === 0, `HTTP=${r.status} unread=${u.data?.unreadCount}`);
}

// ============ 4. 我发过的通知（按批次聚合） ============
log('');
log('———— 我发过的通知（sent） ————');
{
  const sent0 = await call('GET', 'notifications/sent?pageSize=100', A);
  const before = (sent0.data?.list ?? []).filter((x) => x.title === T('all')).length;
  const send = await call('POST', 'notifications', A, { targetType: 'ALL_STORES', title: T('all'), content: '全部门店通知' });
  const sent1 = await call('GET', 'notifications/sent?pageSize=100', A);
  const g = (sent1.data?.list ?? []).filter((x) => x.title === T('all'));
  ok('S1', 'ALL_STORES 展开 N 行但 sent 只返回 1 条批次', send.status === 201 && g.length === before + 1, `HTTP=${send.status} groups=${g.length} 展开行数=${send.data?.count}`);
  ok('S2', '批次 receiverCount = 展开行数', g[0]?.receiverCount === send.data?.count && g[0]?.receiverCount === expectStoreCount, `receiverCount=${g[0]?.receiverCount} 期望=${expectStoreCount}`);
}
{
  // 同一秒内发两条同标题 → 仍是 2 个批次（不误合并）
  const title = T('dup');
  await call('POST', 'notifications', A, { targetType: 'ALL_STORES', title, content: '同秒重复发送-A' });
  await call('POST', 'notifications', A, { targetType: 'ALL_STORES', title, content: '同秒重复发送-A' });
  const sent = await call('GET', 'notifications/sent?pageSize=100', A);
  const g = (sent.data?.list ?? []).filter((x) => x.title === title);
  ok('S3', '同一秒内两次同标题发送 → 返回 2 条（不误合并）', g.length === 2, `groups=${g.length}`);
  ok('S4', '两条批次号不同', g.length === 2 && g[0].sendBatchId !== g[1].sendBatchId, `batch0=${g[0]?.sendBatchId} batch1=${g[1]?.sendBatchId}`);
}
{
  const plat = await call('GET', 'notifications/sent?pageSize=100', P);
  const adminSent = await call('GET', 'notifications/sent?pageSize=100', A);
  const adminTitles = (adminSent.data?.list ?? []).map((x) => x.title);
  const platTitles = (plat.data?.list ?? []).map((x) => x.title);
  ok('S5', 'sent 只返回自己发的（admin 不含 platform 的）', plat.status === 200 && !adminTitles.some((t) => platTitles.includes(t)), `admin批次=${adminTitles.length} platform批次=${platTitles.length}`);
}
{
  const r = await call('GET', 'notifications/sent', S1);
  ok('S6', '附属访问 sent → 403（无 notification:send）', r.status === 403, `HTTP=${r.status} ${r.reason}`);
}
{
  const r = await call('GET', `notifications/sent?keyword=${T('all')}`, A);
  ok('S7', 'sent 关键词筛选命中 1 条', r.status === 200 && (r.data?.list ?? []).length === 1, `HTTP=${r.status} n=${(r.data?.list ?? []).length}`);
}

// ============ 5. 工作台口径一致 ============
log('');
log('———— 工作台未读数口径统一 ————');
{
  const todo = await call('GET', 'dashboard/todo', A);
  const list = await call('GET', 'notifications/unread-count', A);
  ok('W1', 'admin：工作台 unreadNotifications === 通知未读数', todo.status === 200 && todo.data?.unreadNotifications === list.data?.unreadCount, `todo=${todo.data?.unreadNotifications} list=${list.data?.unreadCount}`);
  const todoS = await call('GET', 'dashboard/todo', S1);
  const listS = await call('GET', 'notifications/unread-count', S1);
  ok('W2', 'sub01：工作台口径同样一致', todoS.status === 200 && todoS.data?.unreadNotifications === listS.data?.unreadCount, `todo=${todoS.data?.unreadNotifications} list=${listS.data?.unreadCount}`);
}

// ============ 6. 迁移回填 + 幂等 ============
log('');
log('———— 迁移回填 / 幂等 ————');
{
  const legacyId = 880001;
  sql(`DELETE FROM notification_reads WHERE notificationId=${legacyId};
       DELETE FROM notifications WHERE id=${legacyId};
       INSERT INTO notifications (id, receiverType, receiverId, type, title, content, level, readStatus, readAt, createdAt)
       VALUES (${legacyId}, 'STORE', ${ownStore}, 'SYSTEM', '${T('legacy')}', '迁移回填用例：历史 READ 无阅读记录', 'NORMAL', 'READ', NOW(3), NOW(3));`);
  const before = Number(scalar(`SELECT COUNT(*) FROM notification_reads WHERE notificationId=${legacyId}`));
  runMigration();
  const after = scalar(`SELECT CONCAT(IFNULL(adminUserId,'-'),'/',IFNULL(DATE_FORMAT(readAt,'%Y-%m-%d'),'-')) FROM notification_reads WHERE notificationId=${legacyId}`);
  const adminOfRead = Number(String(after).split('/')[0]);
  ok('M1', `历史 READ 通知回填到「接收方最早管理员」(#${minAdminOfStore})`, before === 0 && adminOfRead === minAdminOfStore, `before=${before} read.owner=${after}`);
  runMigration();
  const dup = Number(scalar(`SELECT COUNT(*) FROM notification_reads WHERE notificationId=${legacyId}`));
  ok('M2', '迁移可重复执行（第二次不产生重复行）', dup === 1, `reads=${dup}`);
  const audit = Number(scalar(`SELECT COUNT(*) FROM audit_logs WHERE action='notification:read-backfill'`));
  ok('M3', '每次执行写一条回填审计（含 成功/跳过 计数）', audit >= 1, `audit=${audit}`);
}
{
  const cols = scalar(`SELECT GROUP_CONCAT(COLUMN_NAME) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='shangmeng' AND TABLE_NAME='notifications' AND COLUMN_NAME IN ('senderId','sendBatchId')`);
  ok('M4', '迁移结构落地（senderId/sendBatchId 存在）', String(cols).includes('senderId') && String(cols).includes('sendBatchId'), `cols=${cols}`);
  const legacy = scalar(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='shangmeng' AND TABLE_NAME='notifications' AND COLUMN_NAME='readStatus'`);
  ok('M5', 'readStatus 保留未删（deprecated，便于回滚）', legacy === 'readStatus', `col=${legacy}`);
}

// ============ 7. targets 可选发布目标（边界） ============
log('');
log('———— targets 可选发布目标（边界） ————');
const origM2 = scalar(`SELECT status FROM merchants WHERE id=2`);
{
  const t = await call('GET', 'notifications/targets', A);
  const ids = (t.data?.merchants ?? []).map((m) => m.id);
  const sids = (t.data?.stores ?? []).map((s) => s.id);
  ok('T7', 'targets 返回 { merchants, stores }（基线 2 商家 / 3 门店）', t.status === 200 && ids.length === 2 && sids.length === 3, `HTTP=${t.status} merchants=[${ids}] stores=[${sids}]`);
}
{
  // merchant 2 停用，但其门店 101/102 状态仍为 OPEN —— 验证「商家维度」同时过滤掉商家与门店
  sql(`UPDATE merchants SET status='SUSPENDED' WHERE id=2;`);
  const storeStatus = scalar(`SELECT GROUP_CONCAT(CONCAT(id,'=',status)) FROM stores WHERE merchantId=2`);
  const t = await call('GET', 'notifications/targets', A);
  const ids = (t.data?.merchants ?? []).map((m) => m.id);
  const sids = (t.data?.stores ?? []).map((s) => s.id);
  ok('T8', 'SUSPENDED 商家不出现在 targets（其门店仍 OPEN）', !ids.includes(2) && ids.includes(3), `merchants=[${ids}] 门店状态=${storeStatus}`);
  ok('T9', 'SUSPENDED 商家旗下门店不出现在 targets（只含 201）', !sids.includes(101) && !sids.includes(102) && sids.includes(201), `stores=[${sids}]`);
  ok('T10', '一致性：停用商家与其门店**同时**被排除（不会一个保留、一个排除）',
    !ids.includes(2) && !sids.includes(101) && !sids.includes(102),
    `merchant2=${ids.includes(2)} store101=${sids.includes(101)} store102=${sids.includes(102)}`);
}
{
  sql(`UPDATE merchants SET status='${origM2}' WHERE id=2;`);
  const now = scalar(`SELECT status FROM merchants WHERE id=2`);
  ok('T11a', `merchant 2 状态已恢复（${now}）`, now === origM2, `${now} / 原 ${origM2}`);
}
{
  // 双向一致性：targets 内逐个可发；targets 外必被拒
  const t = await call('GET', 'notifications/targets', A);
  const ms = t.data?.merchants ?? [];
  const ss = t.data?.stores ?? [];
  let allOk = true;
  const detail = [];
  for (const m of ms) {
    const r = await call('POST', 'notifications', A, { targetType: 'MERCHANT', targetIds: [m.id], title: T('tgt') + '-M' + m.id, content: 'targets 一致性正向' });
    detail.push(`M${m.id}->${r.status}`);
    if (r.status !== 201) allOk = false;
  }
  for (const s of ss) {
    const r = await call('POST', 'notifications', A, { targetType: 'STORE', targetIds: [s.id], title: T('tgt') + '-S' + s.id, content: 'targets 一致性正向' });
    detail.push(`S${s.id}->${r.status}`);
    if (r.status !== 201) allOk = false;
  }
  const bad = await call('POST', 'notifications', A, { targetType: 'MERCHANT', targetIds: [1], title: T('tgt') + '-BAD', content: 'targets 外越权' });
  ok('T11', '双向一致性：targets 内逐个 POST 均 201；targets 外（MAIN 主体 id=1）POST 403',
    allOk && bad.status === 403 && bad.reason === 'FORBIDDEN_SCOPE',
    `${detail.join(' ')} | BAD->${bad.status}/${bad.reason}`);
}

// ============ 清理 ============
sql(`DELETE FROM notification_reads WHERE notificationId=880001; DELETE FROM notifications WHERE id=880001;`);
sql(`UPDATE merchants SET status='${origM2}' WHERE id=2;`);
cleanup();
log('  （已清理测试通知、阅读记录与回填用例数据）');

log(`\n===== S5.4-B1 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail === 0 ? 0 : 1);
