<template>
  <div class="h5">
    <van-nav-bar title="积分明细" />

    <!-- MVP：H5 未接入用户鉴权，用「模拟用户」切换身份；接口与真实链路一致 -->
    <van-notice-bar
      left-icon="info-o"
      color="#92400e"
      background="#fffbeb"
      text="MVP：H5 未接入用户鉴权，用上方「当前用户」切换模拟身份；接口与真实链路一致。"
    />

    <div class="h5__user">
      <span class="h5__label">当前用户</span>
      <van-field
        v-model="userIdInput"
        type="digit"
        placeholder="用户 id"
        input-align="right"
        @blur="onUserChange"
      />
      <span v-if="account" class="h5__balance">
        积分 <b>{{ account.account.balance }}</b>
        <span class="h5__dim">（可用 {{ account.summary.available }}）</span>
      </span>
    </div>

    <van-dropdown-menu active-color="#f59e0b">
      <van-dropdown-item v-model="typeFilter" :options="typeOptions" @change="onFilterChange" />
    </van-dropdown-menu>

    <van-loading v-if="loading" size="20px" class="h5__loading">加载中...</van-loading>
    <van-empty v-else-if="!list.length" description="暂无积分明细" />
    <div v-else class="h5__list">
      <div v-for="t in list" :key="t.id" class="h5__row">
        <div class="h5__row-main">
          <span class="h5__type">{{ pointTxnTypeLabel(t.type) }}</span>
          <span class="h5__amount" :class="amountClass(t.amount)">{{ pointAmountText(t.amount) }}</span>
        </div>
        <div class="h5__remark">{{ t.remark || '—' }}</div>
        <div class="h5__meta">
          <span>{{ t.merchantName || '平台' }}</span>
          <span>{{ formatDateTime(t.createdAt) }}</span>
        </div>
        <div class="h5__after">余额 {{ t.balanceAfter }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { showFailToast } from 'vant';
import { pointApi } from '@/api/point';
import type { PointAccountDetail, PointTransaction, PointTxnType } from '@/types/business';
import { formatDateTime, pointAmountText, pointTxnTypeLabel, POINT_TXN_TYPE_OPTIONS } from '@/utils/dict';

const userIdInput = ref('1001');
const userId = ref(1001);
const account = ref<PointAccountDetail | null>(null);
const list = ref<PointTransaction[]>([]);
const loading = ref(false);
const typeFilter = ref<string>('ALL');
const typeOptions = [
  { text: '全部类型', value: 'ALL' },
  ...POINT_TXN_TYPE_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
];

function amountClass(amount: number) {
  if (amount > 0) return 'plus';
  if (amount < 0) return 'minus';
  return '';
}

async function loadAccount() {
  try {
    account.value = await pointApi.accountDetail(userId.value);
  } catch {
    account.value = null;
  }
}

async function loadList() {
  loading.value = true;
  try {
    const res = await pointApi.transactions({
      page: 1,
      pageSize: 100,
      userId: userId.value,
      type: typeFilter.value === 'ALL' ? undefined : (typeFilter.value as PointTxnType),
    });
    list.value = res.list;
  } catch (e) {
    list.value = [];
    showFailToast((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function onUserChange() {
  const id = Number(userIdInput.value);
  if (!id) return;
  userId.value = id;
  loadAccount();
  loadList();
}

function onFilterChange() {
  loadList();
}

onMounted(() => {
  loadAccount();
  loadList();
});
</script>

<style scoped>
.h5 {
  min-height: 100vh;
  background: #f5f6f8;
}
.h5__user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #fff;
}
.h5__label {
  font-size: 13px;
  color: #64748b;
  white-space: nowrap;
}
.h5__balance {
  margin-left: auto;
  font-size: 13px;
  color: #475569;
  white-space: nowrap;
}
.h5__balance b {
  color: #f59e0b;
  font-size: 16px;
}
.h5__dim {
  color: #94a3b8;
  font-size: 12px;
}
.h5__loading {
  padding: 24px;
  text-align: center;
}
.h5__list {
  padding: 12px;
}
.h5__row {
  background: #fff;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
}
.h5__row-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.h5__type {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}
.h5__amount {
  font-size: 18px;
  font-weight: 700;
}
.h5__amount.plus {
  color: #16a34a;
}
.h5__amount.minus {
  color: #ef4444;
}
.h5__remark {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}
.h5__meta {
  margin-top: 6px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #94a3b8;
}
.h5__after {
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
  text-align: right;
}
</style>
