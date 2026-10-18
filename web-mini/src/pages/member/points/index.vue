<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import EmptyState from '@/components/EmptyState.vue';
import ListSkeleton from '@/components/ListSkeleton.vue';
import NetworkBanner from '@/components/NetworkBanner.vue';
import { fetchPointTransactions } from '@/services/member';
import { dayText } from '@/services/member';
import { friendlyMessage } from '@/utils/errors';

const loading = ref(true);
const loadingMore = ref(false);
const errorText = ref('');
const list = ref<Array<{ id: number; type: string; amount: number; createdAt: string; remark: string | null }>>([]);
const page = ref(1);
const total = ref(0);

const typeText: Record<string, string> = {
  EARN: '获得',
  SPEND: '使用',
  EXPIRE: '过期',
  ADJUST: '调整',
};

async function load(reset: boolean) {
  if (reset) {
    page.value = 1;
    loading.value = list.value.length === 0;
  } else loadingMore.value = true;
  try {
    const data = await fetchPointTransactions(reset ? 1 : page.value, 10);
    total.value = data.total;
    list.value = reset ? data.list : list.value.concat(data.list);
    errorText.value = '';
  } catch (error) {
    errorText.value = friendlyMessage(error, '积分明细没有加载出来');
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function more() {
  if (loading.value || loadingMore.value || list.value.length >= total.value) return;
  page.value += 1;
  load(false);
}

onShow(() => load(true));
</script>

<template>
  <view class="page">
    <network-banner />
    <list-skeleton v-if="loading" />
    <scroll-view v-else scroll-y class="list" @scrolltolower="more">
      <view v-if="errorText" class="fail">{{ errorText }}</view>
      <empty-state v-else-if="!list.length" title="还没有积分明细" hint="获得或使用积分后会出现在这里" />
      <view v-for="item in list" :key="item.id" class="row">
        <view>
          <view>{{ typeText[item.type] || item.type }}</view>
          <view class="time">{{ dayText(item.createdAt) }}</view>
        </view>
        <view :class="item.amount >= 0 ? 'plus' : 'minus'">{{ item.amount > 0 ? '+' : '' }}{{ item.amount }}</view>
      </view>
      <view v-if="loadingMore" class="empty">加载更多…</view>
    </scroll-view>
  </view>
</template>

<style scoped>
.page { min-height: 100vh; padding: 24rpx 32rpx; box-sizing: border-box; }
.list { height: calc(100vh - 48rpx); }
.row { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; display: flex; justify-content: space-between; align-items: center; }
.time { margin-top: 6rpx; color: #94a3b8; font-size: 24rpx; }
.plus { color: #0f766e; font-weight: 700; }
.minus { color: #b91c1c; font-weight: 700; }
.empty, .fail { color: #64748b; padding: 20rpx 0; }
.fail { color: #b91c1c; font-weight: 700; }
.skel { height: 140rpx; background: #e2e8f0; border-radius: 16rpx; }
</style>
