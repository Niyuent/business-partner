<template>
  <div class="page">
    <el-card shadow="never" v-loading="loading">
      <!-- 指标卡片：订单 / 核销 / 兑换 / 发券 / 积分发行 / 积分消耗 -->
      <div class="section-title">经营概览</div>
      <el-row :gutter="12" class="cards">
        <el-col v-for="c in metricCards" :key="c.key" :span="4">
          <el-card shadow="hover" class="metric" @click="onCardClick(c.key)">
            <el-statistic :title="c.label" :value="c.value" />
            <div class="card-sub">单位：{{ c.unit }} · 环比 {{ c.trend >= 0 ? '+' : '' }}{{ c.trend }}%</div>
          </el-card>
        </el-col>

        <!-- 主体/平台专属：管理类卡片（附属/店员无 merchant:audit 权限，自动隐藏） -->
        <el-col v-permission="'merchant:audit'" :span="4">
          <el-card shadow="hover" class="metric" @click="$router.push('/main/merchant-applications')">
            <el-statistic title="待审核商家" :value="todo.pendingMerchants" />
            <div class="card-sub link">点击前往审核 →</div>
          </el-card>
        </el-col>
        <el-col v-permission="'merchant:audit'" :span="4">
          <el-card shadow="hover" class="metric" @click="$router.push('/main/orders/abnormal')">
            <el-statistic title="异常订单" :value="todo.abnormalOrders" />
            <div class="card-sub link">点击前往处理 →</div>
          </el-card>
        </el-col>

        <!-- 待办汇总卡：所有人可见 -->
        <el-col :span="4">
          <el-card shadow="hover" class="metric todo" @click="onTodoClick">
            <el-statistic title="待办事项" :value="todoTotal" />
            <div class="card-sub">
              待审 {{ todo.pendingMerchants }} · 异常 {{ todo.abnormalOrders }} · 未读 {{ todo.unreadNotifications }}
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 趋势：订单 / 核销 / 兑换 -->
      <el-card shadow="never" header="近 7 天趋势" style="margin-top: 12px">
        <EChart v-if="hasTrend" :option="trendOption" height="320px" />
        <el-empty v-else description="暂无趋势数据" />
      </el-card>

      <!-- 饼图：券类型分布 + 积分来源分布 -->
      <el-row :gutter="12" style="margin-top: 12px">
        <el-col :span="12">
          <el-card shadow="never" header="券类型分布（主体券 / 附属商家券）">
            <EChart v-if="hasCoupon" :option="couponPieOption" height="300px" />
            <el-empty v-else description="暂无券数据" />
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="never" header="积分来源分布">
            <EChart v-if="hasPoint" :option="pointPieOption" height="300px" />
            <el-empty v-else description="暂无积分数据" />
          </el-card>
        </el-col>
      </el-row>

      <!-- 柱状图：Top5 商家（仅主体/平台可见） -->
      <el-card v-permission="'merchant:audit'" shadow="never" header="交易额 Top5 商家" style="margin-top: 12px">
        <EChart v-if="hasTop" :option="topOption" height="320px" />
        <el-empty v-else description="暂无商家交易数据" />
      </el-card>

      <!-- 待办区：可点击跳转 -->
      <el-card shadow="never" header="待办事项" style="margin-top: 12px">
        <el-row :gutter="12">
          <el-col :span="8">
            <div class="todo-item" @click="$router.push('/main/merchant-applications')">
              <span class="todo-label">待审核商家</span>
              <span class="todo-num">{{ todo.pendingMerchants }}</span>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="todo-item" @click="$router.push('/main/orders/abnormal')">
              <span class="todo-label">异常订单</span>
              <span class="todo-num warn">{{ todo.abnormalOrders }}</span>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="todo-item" @click="$router.push('/main/notifications')">
              <span class="todo-label">未读通知</span>
              <span class="todo-num">{{ todo.unreadNotifications }}</span>
            </div>
          </el-col>
        </el-row>
      </el-card>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import EChart from '@/views/common/EChart.vue';
import { reportApi, type DashboardCard, type DashboardStats, type DashboardTrend, type DashboardDistribution, type DashboardTopMerchant } from '@/api/report';

const router = useRouter();

const loading = ref(false);
const stats = ref<DashboardStats | null>(null);
const trend = ref<DashboardTrend | null>(null);
const dist = ref<DashboardDistribution | null>(null);
const top = ref<DashboardTopMerchant[]>([]);

const todo = computed(
  () => stats.value?.todo ?? { pendingMerchants: 0, abnormalOrders: 0, unreadNotifications: 0 },
);
const todoTotal = computed(
  () => todo.value.pendingMerchants + todo.value.abnormalOrders + todo.value.unreadNotifications,
);

const metricCards = computed(() => (stats.value?.cards ?? []) as DashboardCard[]);

// 卡片点击 → 对应列表页
const CARD_ROUTE: Record<string, string> = {
  orders: '/main/orders',
  redemptions: '/main/redemptions',
  exchanges: '/main/redemptions',
  coupons: '/main/coupon-instances',
  pointIssued: '/main/points',
  pointConsumed: '/main/points',
};
function onCardClick(key: string) {
  const to = CARD_ROUTE[key];
  if (to) router.push(to);
}
function onTodoClick() {
  if (todo.value.pendingMerchants) return router.push('/main/merchant-applications');
  if (todo.value.abnormalOrders) return router.push('/main/orders/abnormal');
  return router.push('/main/notifications');
}

// ---- 趋势折线 ----
const hasTrend = computed(
  () => !!trend.value && (trend.value.orders.some((v) => v > 0) || trend.value.redemptions.some((v) => v > 0) || trend.value.exchanges.some((v) => v > 0)),
);
const trendOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['订单', '核销', '兑换'] },
  grid: { left: 48, right: 24, top: 40, bottom: 32 },
  xAxis: { type: 'category', data: trend.value?.dates ?? [] },
  yAxis: { type: 'value' },
  series: [
    { name: '订单', type: 'line', smooth: true, data: trend.value?.orders ?? [] },
    { name: '核销', type: 'line', smooth: true, data: trend.value?.redemptions ?? [] },
    { name: '兑换', type: 'line', smooth: true, data: trend.value?.exchanges ?? [] },
  ],
}));

// ---- 饼图：券类型分布（ownerType → 中文） ----
const OWNER_LABEL: Record<string, string> = { MAIN_COUPON: '主体券', SUB_COUPON: '附属商家券' };
const hasCoupon = computed(() => !!dist.value && dist.value.couponTypes.length > 0);
const couponPieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  legend: { bottom: 0 },
  series: [
    {
      type: 'pie',
      radius: ['40%', '70%'],
      data: (dist.value?.couponTypes ?? []).map((r) => ({
        name: OWNER_LABEL[r.type] ?? r.type,
        value: r.count,
      })),
    },
  ],
}));

// ---- 饼图：积分来源分布（type → 中文） ----
const POINT_LABEL: Record<string, string> = {
  EARN: '积分发行',
  SPEND: '积分消耗',
  EXPIRE: '过期清零',
  REFUND: '退款',
  ADJUST: '人工调整',
};
const hasPoint = computed(() => !!dist.value && dist.value.pointSources.length > 0);
const pointPieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  legend: { bottom: 0 },
  series: [
    {
      type: 'pie',
      radius: ['40%', '70%'],
      data: (dist.value?.pointSources ?? []).map((r) => ({
        name: POINT_LABEL[r.type] ?? r.type,
        value: r.value,
      })),
    },
  ],
}));

// ---- 柱状图：Top5 商家（仅主体/平台返回数据，附属/店员此处已被 v-permission 隐藏） ----
const hasTop = computed(() => top.value.length > 0);
const topOption = computed(() => {
  const rows = [...top.value].reverse(); // 金额高在下，视觉更直观
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 96, right: 32, top: 24, bottom: 32 },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: rows.map((r) => r.name) },
    series: [
      {
        type: 'bar',
        data: rows.map((r) => r.amount),
        label: { show: true, position: 'right' },
        itemStyle: { color: '#409eff' },
      },
    ],
  };
});

async function loadAll() {
  loading.value = true;
  try {
    const [s, t, d, m] = await Promise.all([
      reportApi.dashboardStats(),
      reportApi.dashboardTrend(7),
      reportApi.dashboardDistribution(),
      reportApi.dashboardTopMerchants(),
    ]);
    stats.value = s;
    trend.value = t;
    dist.value = d;
    top.value = m;
  } finally {
    loading.value = false;
  }
}
onMounted(loadAll);
</script>

<style scoped>
.section-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
}
.cards {
  margin-bottom: 4px;
}
.metric {
  cursor: pointer;
  transition: transform 0.1s;
}
.metric:hover {
  transform: translateY(-2px);
}
.card-sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.card-sub.link {
  color: var(--el-color-primary);
}
.todo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
}
.todo-item:hover {
  background: var(--el-fill-color-light);
}
.todo-label {
  font-size: 14px;
  color: var(--el-text-color-regular);
}
.todo-num {
  font-size: 22px;
  font-weight: 700;
  color: var(--el-color-primary);
}
.todo-num.warn {
  color: var(--el-color-danger);
}
</style>
