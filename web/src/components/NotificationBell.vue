<template>
  <el-popover
    v-model:visible="panelVisible"
    placement="bottom-end"
    :width="360"
    trigger="click"
    :offset="8"
    popper-class="bell__popover"
    @show="onPanelShow"
  >
    <template #reference>
      <el-badge :value="badgeValue" :max="99" :hidden="badgeValue === 0" class="bell__badge">
        <el-button class="bell__trigger" text :aria-label="badgeValue > 0 ? `通知，${badgeValue} 条未读` : '通知'">
          <el-icon :size="20"><Bell /></el-icon>
        </el-button>
      </el-badge>
    </template>

    <!-- 标题栏 -->
    <div class="bell__header">
      <span class="bell__title">通知</span>
      <el-button
        v-if="list.length > 0"
        text
        type="primary"
        size="small"
        :loading="markingAll"
        @click="onMarkAllRead"
      >
        全部已读
      </el-button>
    </div>

    <!-- 列表区：最近 5 条未读 -->
    <div v-loading="listLoading" class="bell__body">
      <ul v-if="list.length > 0" class="bell__list">
        <li v-for="item in list" :key="item.id" class="bell__item" @click="onItemClick(item)">
          <span class="bell__dot" :class="`bell__dot--${item.level.toLowerCase()}`" />
          <div class="bell__item-main">
            <div class="bell__item-title">{{ item.title }}</div>
            <div class="bell__item-time">{{ formatDateTime(item.createdAt) }}</div>
          </div>
        </li>
      </ul>
      <el-empty v-else-if="!listLoading" description="暂无未读通知" :image-size="60" />
    </div>

    <!-- 底部栏 -->
    <div class="bell__footer">
      <el-button text type="primary" size="small" @click="onViewAll">查看全部</el-button>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Bell } from '@element-plus/icons-vue';
import { notificationApi, type NotificationItem } from '@/api/notification';
import { useNotificationStore } from '@/stores/notification';
import { useUserStore } from '@/stores/user';
import { formatDateTime } from '@/utils/dict';

const router = useRouter();
const store = useNotificationStore();
const userStore = useUserStore();

const panelVisible = ref(false);
const listLoading = ref(false);
const markingAll = ref(false);
const list = ref<NotificationItem[]>([]);

/** 徽标数字：未读 > 99 显示 99+（由 el-badge 的 max 处理） */
const badgeValue = computed(() => store.unreadCount);

/** 通知中心入口：主体 / 平台 → 后台页；附属 / 店员 → 附属侧页 */
const inboxPath = computed(() =>
  userStore.hasPermission('notification:send') ? '/main/notifications?tab=inbox' : '/sub/notifications',
);

// ---------------------------------------------------------------- 面板数据

/** 每次打开面板都重新拉最近 5 条未读（面板是"即时快照"，不做缓存） */
async function onPanelShow() {
  listLoading.value = true;
  try {
    const res = await notificationApi.list({ readStatus: 'UNREAD', page: 1, pageSize: 5 });
    list.value = res.list;
  } catch {
    list.value = []; // 静默：铃铛不该为一次失败弹 toast
  } finally {
    listLoading.value = false;
  }
}

/** 点击单条：标记已读 → 关闭面板 → 跳通知中心 */
async function onItemClick(item: NotificationItem) {
  if (item.alreadyRead) return;
  try {
    await notificationApi.markRead(item.id);
    store.decrement();
    store.bumpReadState(); // 让可能打开着的通知中心页同步刷新
    list.value = list.value.filter((n) => n.id !== item.id);
  } catch {
    ElMessage.error('标记已读失败');
    return;
  }
  panelVisible.value = false;
  void router.push(inboxPath.value);
}

async function onMarkAllRead() {
  markingAll.value = true;
  try {
    const res = await notificationApi.markAllRead();
    store.clear();
    store.bumpReadState();
    list.value = [];
    ElMessage.success(`已标记 ${res.updated} 条为已读`);
  } catch (e) {
    ElMessage.error((e as Error).message || '全部已读失败');
  } finally {
    markingAll.value = false;
  }
}

function onViewAll() {
  panelVisible.value = false;
  void router.push(inboxPath.value);
}

// ---------------------------------------------------------------- 未读数轮询

const POLL_MS = 60 * 1000;
let timer: ReturnType<typeof setInterval> | undefined;
let lastFetchedAt = 0;

async function pollUnread() {
  // 页面不可见时不请求：既省流量，也避免后台标签页一直打接口
  if (document.visibilityState !== 'visible') return;
  lastFetchedAt = Date.now();
  await store.refresh(); // store 内部已 catch，失败静默（红点保持原值）
}

function startPolling() {
  stopPolling();
  timer = setInterval(() => void pollUnread(), POLL_MS);
}

function stopPolling() {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

/** 从后台切回前台：若距上次拉取已满一个周期，立即补一次（否则干等 60s） */
function onVisibilityChange() {
  if (document.visibilityState === 'visible' && Date.now() - lastFetchedAt >= POLL_MS) {
    void pollUnread();
  }
}

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibilityChange);
  // store 未加载过才请求：从通知中心页进来时 list 接口已顺带带回未读数，不重复打
  if (!store.loaded) {
    lastFetchedAt = Date.now();
    await store.refresh();
  }
  startPolling();
});

onUnmounted(() => {
  stopPolling();
  document.removeEventListener('visibilitychange', onVisibilityChange);
});

// TODO(sse): 60s 轮询是临时方案，S7 SSE 落地后改为事件推送（notification:new → 直接更新红点）
</script>

<style scoped>
.bell__badge {
  /* 铃铛图标与顶栏其它元素垂直对齐 */
  display: inline-flex;
  align-items: center;
}
.bell__trigger {
  height: 32px;
  padding: 0 6px;
  color: #475569;
}
.bell__trigger:hover {
  color: #1d2129;
}
.bell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 10px;
  border-bottom: 1px solid #f1f5f9;
}
.bell__title {
  font-size: 14px;
  font-weight: 600;
}
.bell__body {
  max-height: 320px;
  overflow-y: auto;
}
.bell__list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.bell__item {
  display: flex;
  gap: 8px;
  padding: 10px 6px;
  border-radius: 6px;
  cursor: pointer;
}
.bell__item:hover {
  background: #f8fafc;
}
.bell__dot {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
}
.bell__dot--urgent {
  background: #f56c6c;
}
.bell__dot--important {
  background: #e6a23c;
}
.bell__dot--normal {
  background: #94a3b8;
}
.bell__item-main {
  min-width: 0;
  flex: 1;
}
.bell__item-title {
  font-size: 13px;
  color: #1d2129;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bell__item-time {
  margin-top: 2px;
  font-size: 12px;
  color: #94a3b8;
}
.bell__footer {
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
  text-align: center;
}
</style>
