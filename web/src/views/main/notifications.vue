<template>
  <div class="page">
    <el-card shadow="never">
      <!-- 顶栏：标题 + 未读数 + 发布入口 -->
      <div class="page__toolbar">
        <div class="page__toolbar-title">
          通知中心
          <el-tag v-if="unreadCount > 0" size="small" type="danger" class="page__badge">
            {{ unreadCount }} 条未读
          </el-tag>
        </div>
        <el-button v-permission="'notification:send'" type="primary" :icon="Plus" @click="sendVisible = true">
          发布通知
        </el-button>
      </div>

      <el-tabs v-model="activeTab">
        <!-- ============ 收件箱 ============ -->
        <el-tab-pane label="收件箱" name="inbox">
          <el-form :inline="true" class="page__filter">
            <el-form-item label="状态">
              <el-radio-group v-model="inboxQuery.readStatus" @change="onInboxSearch">
                <el-radio-button value="">全部</el-radio-button>
                <el-radio-button value="UNREAD">未读</el-radio-button>
                <el-radio-button value="READ">已读</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="类型">
              <el-select
                v-model="inboxQuery.type"
                clearable
                placeholder="全部类型"
                style="width: 160px"
                @change="onInboxSearch"
              >
                <el-option
                  v-for="(label, value) in NOTIFICATION_TYPE_LABELS"
                  :key="value"
                  :label="label"
                  :value="value"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button :loading="inboxLoading" @click="loadInbox">刷新</el-button>
              <el-button :disabled="unreadCount === 0" :loading="markingAll" @click="onMarkAllRead">
                全部已读
              </el-button>
            </el-form-item>
          </el-form>

          <el-table
            v-loading="inboxLoading"
            :data="inboxList"
            border
            stripe
            class="page__table--clickable"
            @row-click="onInboxRowClick"
          >
            <el-table-column label="级别" width="90">
              <template #default="{ row }">
                <el-tag :type="levelTagType(row.level)" size="small">{{ levelLabel(row.level) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="标题" min-width="220">
              <template #default="{ row }">
                <span v-if="!row.alreadyRead" class="page__dot" />
                <span class="page__title">{{ row.title }}</span>
              </template>
            </el-table-column>
            <el-table-column label="内容" min-width="260">
              <template #default="{ row }">
                <div class="page__summary">{{ row.content }}</div>
              </template>
            </el-table-column>
            <el-table-column label="类型" width="110">
              <template #default="{ row }">{{ typeLabel(row.type) }}</template>
            </el-table-column>
            <el-table-column label="时间" width="170">
              <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="!row.alreadyRead"
                  link
                  type="primary"
                  @click.stop="onMarkRead(row)"
                >
                  标记已读
                </el-button>
                <span v-else class="page__dim">已读</span>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty :description="inboxEmptyText" />
            </template>
          </el-table>

          <el-pagination
            class="page__pager"
            background
            layout="total, sizes, prev, pager, next"
            :total="inboxTotal"
            v-model:current-page="inboxQuery.page"
            v-model:page-size="inboxQuery.pageSize"
            :page-sizes="[10, 20, 50]"
            @size-change="loadInbox"
            @current-change="loadInbox"
          />
          <div class="page__hint">点击任意一行可查看全文并自动标记已读</div>
        </el-tab-pane>

        <!-- ============ 发件箱 ============ -->
        <el-tab-pane v-if="canSend" label="发件箱" name="sent">
          <el-form :inline="true" class="page__filter">
            <el-form-item label="标题">
              <el-input
                v-model="sentQuery.keyword"
                clearable
                placeholder="标题关键词"
                style="width: 200px"
                @keyup.enter="onSentSearch"
              />
            </el-form-item>
            <el-form-item label="类型">
              <el-select
                v-model="sentQuery.type"
                clearable
                placeholder="全部类型"
                style="width: 160px"
                @change="onSentSearch"
              >
                <el-option
                  v-for="(label, value) in NOTIFICATION_TYPE_LABELS"
                  :key="value"
                  :label="label"
                  :value="value"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="sentLoading" @click="onSentSearch">查询</el-button>
              <el-button :loading="sentLoading" @click="resetSentFilter">重置</el-button>
            </el-form-item>
          </el-form>

          <el-table
            v-loading="sentLoading"
            :data="sentList"
            border
            stripe
            class="page__table--clickable"
            @row-click="onSentRowClick"
          >
            <el-table-column label="标题" min-width="220">
              <template #default="{ row }">
                <span class="page__title">{{ row.title }}</span>
              </template>
            </el-table-column>
            <el-table-column label="内容" min-width="260">
              <template #default="{ row }">
                <div class="page__summary">{{ row.content }}</div>
              </template>
            </el-table-column>
            <el-table-column label="接收人数" width="110" align="center">
              <template #default="{ row }">
                <el-tag size="small" type="info">{{ row.receiverCount }} 人</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="类型" width="110">
              <template #default="{ row }">{{ typeLabel(row.type) }}</template>
            </el-table-column>
            <el-table-column label="级别" width="90">
              <template #default="{ row }">
                <el-tag :type="levelTagType(row.level)" size="small">{{ levelLabel(row.level) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="发送时间" width="170">
              <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click.stop="onSentRowClick(row)">收件人</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="还没有发过通知" />
            </template>
          </el-table>

          <el-pagination
            class="page__pager"
            background
            layout="total, sizes, prev, pager, next"
            :total="sentTotal"
            v-model:current-page="sentQuery.page"
            v-model:page-size="sentQuery.pageSize"
            :page-sizes="[10, 20, 50]"
            @size-change="loadSent"
            @current-change="loadSent"
          />
          <div class="page__hint">一次「发布」= 一行；「全部附属 / 全部门店」展开的多人发送已合并显示</div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 通知全文（点行打开；打开即标记已读） -->
    <el-drawer v-model="detailVisible" title="通知详情" size="640px">
      <template v-if="detail">
        <div class="page__detail-head">
          <el-tag :type="levelTagType(detail.level)" size="small">{{ levelLabel(detail.level) }}</el-tag>
          <span class="page__detail-title">{{ detail.title }}</span>
        </div>
        <div class="page__detail-meta">
          {{ typeLabel(detail.type) }} · {{ formatDateTime(detail.createdAt) }}
          <el-tag v-if="detail.alreadyRead" size="small" type="success" class="page__detail-read">已读</el-tag>
          <el-tag v-else size="small" type="warning">未读</el-tag>
        </div>
        <el-divider content-position="left">正文</el-divider>
        <div class="page__detail-content">{{ detail.content }}</div>
      </template>
    </el-drawer>

    <!-- 某批发送的收件人 -->
    <el-dialog v-model="receiversVisible" title="本批收件人" width="720px">
      <div v-loading="receiversLoading" class="page__receivers">
        <el-alert
          v-if="receivers.length >= 500"
          type="warning"
          show-icon
          :closable="false"
          title="收件人数达到 500 上限，仅展示前 500 条（正常发送远小于此）"
          class="page__receivers-alert"
        />
        <el-table :data="receivers" border stripe max-height="420">
          <el-table-column label="类型" width="110">
            <template #default="{ row }">
              <el-tag size="small" :type="row.receiverType === 'STORE' ? 'success' : 'warning'">
                {{ row.receiverType === 'STORE' ? '门店' : '附属商家' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称" min-width="200" />
          <el-table-column prop="code" label="编码" width="140">
            <template #default="{ row }">{{ row.code || '—' }}</template>
          </el-table-column>
          <el-table-column label="所属商家" min-width="140">
            <template #default="{ row }">
              <span v-if="row.receiverType === 'STORE'">{{ merchantName(row.merchantId) }}</span>
              <span v-else class="page__dim">—（商家本身）</span>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="没有收件人" />
          </template>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="receiversVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 发布通知：S5.4-B2 第 5 步 -->
    <NotificationSendDialog v-model="sendVisible" @sent="onSent" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFY_LEVEL_LABELS,
  notificationApi,
  type NotificationItem,
  type NotificationType,
  type NotifyLevel,
  type ReadStatus,
  type SentBatchReceiver,
  type SentItem,
} from '@/api/notification';
import { useUserStore } from '@/stores/user';
import { useNotificationStore } from '@/stores/notification';
import NotificationSendDialog from '@/components/NotificationSendDialog.vue';
import { formatDateTime } from '@/utils/dict';

type TabKey = 'inbox' | 'sent';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

/** 发布权限（决定「发布通知」按钮与「发件箱」Tab 是否出现；后端仍会二次校验） */
const canSend = computed(() => userStore.hasPermission('notification:send'));

// ---------------------------------------------------- Tab 与 URL 同步
const activeTab = ref<TabKey>(route.query.tab === 'sent' && canSend.value ? 'sent' : 'inbox');

watch(activeTab, (tab) => {
  // 主动改 URL（replace：切 Tab 不产生新的历史记录，后退不会在 Tab 间打转）
  router.replace({ path: '/main/notifications', query: { tab } });
  if (tab === 'sent') loadSent();
  else loadInbox();
});

// 处理浏览器前进/后退带来的 tab 变化
watch(
  () => route.query.tab,
  (tab) => {
    const next: TabKey = tab === 'sent' && canSend.value ? 'sent' : 'inbox';
    if (next !== activeTab.value) activeTab.value = next;
  },
);

// ---------------------------------------------------- 收件箱
const inboxLoading = ref(false);
const markingAll = ref(false);
const inboxList = ref<NotificationItem[]>([]);
const inboxTotal = ref(0);
/** 未读数改为 store 单一数据源（页面徽标与第 6 步铃铛共用，避免口径不一致） */
const notificationStore = useNotificationStore();
const unreadCount = computed(() => notificationStore.unreadCount);

/**
 * 铃铛（挂在 AdminLayout，任何页面都能点）标记已读 / 全部已读后，
 * 通过 store 的版本号通知本页刷新收件箱，避免出现「铃铛说 0 未读、列表还挂着红点」。
 */
watch(
  () => notificationStore.readStateVersion,
  () => {
    if (activeTab.value === 'inbox') void loadInbox();
  },
);
const inboxQuery = reactive({
  page: 1,
  pageSize: 10,
  readStatus: '' as ReadStatus | '',
  type: '' as NotificationType | '',
});

const inboxEmptyText = computed(() => {
  if (inboxQuery.readStatus === 'UNREAD') return '没有未读通知';
  if (inboxQuery.readStatus === 'READ') return '没有已读通知';
  return '暂无通知';
});

async function loadInbox() {
  inboxLoading.value = true;
  try {
    const res = await notificationApi.list({
      page: inboxQuery.page,
      pageSize: inboxQuery.pageSize,
      readStatus: inboxQuery.readStatus || undefined,
      type: inboxQuery.type || undefined,
    });
    inboxList.value = res.list;
    inboxTotal.value = res.total;
    notificationStore.setCount(res.unreadCount);
  } finally {
    inboxLoading.value = false;
  }
}

function onInboxSearch() {
  inboxQuery.page = 1;
  loadInbox();
}

/** 标记单条已读；在「未读」筛选下会让该行消失，因此需要重新拉列表 */
async function onMarkRead(row: NotificationItem) {
  if (row.alreadyRead) return;
  try {
    await notificationApi.markRead(row.id);
    row.alreadyRead = true;
    notificationStore.decrement();
    if (inboxQuery.readStatus === 'UNREAD') {
      // 未读视图下该行已不符合筛选，退回上一页边界后重拉
      if (inboxList.value.length === 1 && inboxQuery.page > 1) inboxQuery.page -= 1;
      await loadInbox();
    }
    ElMessage.success('已标记为已读');
  } catch (e) {
    ElMessage.error((e as Error).message || '标记已读失败');
  }
}

async function onMarkAllRead() {
  try {
    await ElMessageBox.confirm(`确认将 ${unreadCount.value} 条未读通知全部标记为已读？`, '提示', { type: 'warning' });
  } catch {
    return; // 用户取消
  }
  markingAll.value = true;
  try {
    const res = await notificationApi.markAllRead();
    ElMessage.success(`已标记 ${res.updated} 条为已读`);
    notificationStore.clear();
    if (inboxQuery.readStatus === 'READ' || inboxQuery.readStatus === '') {
      await loadInbox();
    } else {
      inboxList.value = [];
      inboxTotal.value = 0;
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '全部已读失败');
  } finally {
    markingAll.value = false;
  }
}

// ---------------------------------------------------- 通知详情
const detailVisible = ref(false);
const detail = ref<NotificationItem | null>(null);

async function onInboxRowClick(row: NotificationItem) {
  detail.value = row;
  detailVisible.value = true;
  await onMarkRead(row);
}

// ---------------------------------------------------- 发件箱
const sentLoading = ref(false);
const sentList = ref<SentItem[]>([]);
const sentTotal = ref(0);
const sentQuery = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  type: '' as NotificationType | '',
});

async function loadSent() {
  sentLoading.value = true;
  try {
    const res = await notificationApi.sent({
      page: sentQuery.page,
      pageSize: sentQuery.pageSize,
      keyword: sentQuery.keyword.trim() || undefined,
      type: sentQuery.type || undefined,
    });
    sentList.value = res.list;
    sentTotal.value = res.total;
  } finally {
    sentLoading.value = false;
  }
}

function onSentSearch() {
  sentQuery.page = 1;
  loadSent();
}

function resetSentFilter() {
  sentQuery.keyword = '';
  sentQuery.type = '';
  onSentSearch();
}

// ---------------------------------------------------- 某批收件人
const receiversVisible = ref(false);
const receiversLoading = ref(false);
const receivers = ref<SentBatchReceiver[]>([]);

async function onSentRowClick(row: SentItem) {
  receiversVisible.value = true;
  receiversLoading.value = true;
  receivers.value = [];
  try {
    const res = await notificationApi.receivers(row.sendBatchId);
    receivers.value = res.receivers;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载收件人失败');
  } finally {
    receiversLoading.value = false;
  }
}

/** 门店行展示所属商家名：直接在本批收件人里找该 merchantId 对应的商家行 */
function merchantName(merchantId: number | null) {
  if (merchantId === null) return '—';
  return receivers.value.find((r) => r.receiverType === 'MERCHANT' && r.receiverId === merchantId)?.name ?? `商家 #${merchantId}`;
}

// ---------------------------------------------------- 发布
const sendVisible = ref(false);

/** 发布成功：刷新当前 Tab 列表 + 同步未读数（铃铛第 6 步接同一 store） */
async function onSent() {
  if (activeTab.value === 'sent') {
    sentQuery.page = 1;
    await loadSent();
  } else {
    await loadInbox();
  }
  await notificationStore.refresh();
}

function levelTagType(level: string) {
  if (level === 'URGENT') return 'danger';
  if (level === 'IMPORTANT') return 'warning';
  return 'info';
}

/**
 * el-table 插槽的 row 是 any，直接 `NOTIFY_LEVEL_LABELS[row.level]` 会被判为隐式 any 索引；
 * 统一走这两个辅助函数收敛（未知值原样返回，避免页面出现 undefined）。
 */
function levelLabel(level: string) {
  return NOTIFY_LEVEL_LABELS[level as NotifyLevel] ?? level;
}
function typeLabel(type: string) {
  return NOTIFICATION_TYPE_LABELS[type as NotificationType] ?? type;
}

onMounted(() => {
  // 初始 Tab 由 URL 决定；确保 DOM 渲染后再拉数据，避免 el-tabs 懒加载拿到空 pane
  nextTick(() => {
    if (activeTab.value === 'sent') loadSent();
    else loadInbox();
  });
});
</script>

<style scoped>
.page__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.page__toolbar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}
.page__badge {
  font-weight: 400;
}
.page__filter {
  margin-bottom: 4px;
}
.page__pager {
  margin-top: 16px;
  justify-content: flex-end;
}
.page__hint {
  margin-top: 8px;
  font-size: 12px;
  color: #94a3b8;
}
.page__table--clickable :deep(.el-table__row) {
  cursor: pointer;
}
.page__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
  background: #f56c6c;
  vertical-align: middle;
}
.page__title {
  font-weight: 500;
}
.page__summary {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
.page__dim {
  color: #94a3b8;
}
.page__detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.page__detail-title {
  font-size: 16px;
  font-weight: 600;
}
.page__detail-meta {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #64748b;
}
.page__detail-read {
  font-weight: 400;
}
.page__detail-content {
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.7;
  font-size: 14px;
}
.page__receivers-alert {
  margin-bottom: 12px;
}
</style>
