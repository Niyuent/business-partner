<script setup lang="ts">
import { ref } from 'vue';
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app';
import EmptyState from '@/components/EmptyState.vue';
import ListSkeleton from '@/components/ListSkeleton.vue';
import NetworkBanner from '@/components/NetworkBanner.vue';
import { dayText, fetchPointTransactions } from '@/services/member';
import { friendlyMessage } from '@/utils/errors';

const loading = ref(true);
const loadingMore = ref(false);
const errorText = ref('');
type PointRow = {
  id: number;
  label: string;
  amount: number;
  day: string;
  allianceName: string;
  merchantName: string;
  kindTag: string;
  kindClass: string;
  isEarn: boolean;
};
const list = ref<PointRow[]>([]);
const page = ref(1);
const total = ref(0);

const typeText: Record<string, string> = {
  EARN: '获得',
  SPEND: '使用',
  EXPIRE: '过期',
  ADJUST: '调整',
  REFUND: '退回',
};

function mapRow(row: {
  id: number;
  type: string;
  amount: number;
  createdAt: string;
  allianceName?: string | null;
  sourceRole?: 'MAIN' | 'SUB' | null;
  merchantName?: string | null;
}): PointRow {
  const isEarn = row.type === 'EARN' && row.amount > 0;
  const isSub = row.sourceRole === 'SUB';
  let label = typeText[row.type] || row.type;
  let kindTag = '';
  let kindClass = '';
  if (isEarn) {
    kindTag = isSub ? '专属积分' : '通用积分';
    kindClass = isSub ? 'tag--sub' : 'tag--main';
    label = isSub ? '附属消费获得' : '主体消费获得';
  }
  return {
    id: row.id,
    label,
    amount: row.amount,
    day: dayText(row.createdAt),
    allianceName: row.allianceName || '',
    merchantName: row.merchantName || '',
    kindTag,
    kindClass,
    isEarn,
  };
}

async function load(reset: boolean) {
  if (reset) {
    page.value = 1;
    loading.value = list.value.length === 0;
  } else {
    if (list.value.length >= 50) return;
    loadingMore.value = true;
  }
  try {
    const data = await fetchPointTransactions(reset ? 1 : page.value, 10);
    total.value = data.total;
    const rows = (data.list || []).map(mapRow);
    list.value = reset ? rows : list.value.concat(rows).slice(0, 50);
    errorText.value = '';
  } catch (error) {
    if (!list.value.length) errorText.value = friendlyMessage(error, '积分明细没有加载出来');
  } finally {
    loading.value = false;
    loadingMore.value = false;
    uni.stopPullDownRefresh();
  }
}

function more() {
  if (loading.value || loadingMore.value || list.value.length >= total.value) return;
  page.value += 1;
  load(false);
}

onShow(() => load(true));
onPullDownRefresh(() => load(true));
onReachBottom(() => more());
</script>

<template>
  <view class="page">
    <network-banner />
    <view class="hint">
      通用积分可在所有店换券；专属积分仅限在主体店换券
    </view>
    <list-skeleton v-if="loading && !list.length" />
    <view v-else class="list">
      <view v-if="errorText && !list.length" class="fail">{{ errorText }}</view>
      <empty-state v-else-if="!list.length" title="还没有积分明细" hint="获得或使用积分后会出现在这里" />
      <template v-else>
        <view v-for="item in list" :key="item.id" class="row" hover-class="press" hover-start-time="20">
          <view class="row__main">
            <view class="row__top">
              <text class="row__label">{{ item.label }}</text>
              <text v-if="item.kindTag" class="tag" :class="item.kindClass">{{ item.kindTag }}</text>
            </view>
            <text class="time">{{ item.day }}</text>
          </view>
          <view class="amt">
            <text :class="item.amount >= 0 ? 'plus' : 'minus'">
              {{ item.amount > 0 ? '+' : '' }}{{ item.amount }}
              <text v-if="item.isEarn" class="amt-kind">{{ item.kindTag }}</text>
            </text>
            <text v-if="item.merchantName || item.allianceName" class="amt-tag">
              [{{ item.merchantName || item.allianceName }}]
            </text>
          </view>
        </view>
        <text v-if="loadingMore" class="empty">正在加载…</text>
        <text v-else-if="list.length >= total || list.length >= 50" class="empty">没有更多了</text>
      </template>
    </view>
  </view>
</template>

<style scoped>
.page { min-height: 100vh; padding: 24rpx 32rpx; box-sizing: border-box; }
.hint {
  margin-bottom: 16rpx; padding: 16rpx 20rpx; border-radius: 16rpx;
  background: #e8fbf7; color: #00766a; font-size: 22rpx; line-height: 1.45; font-weight: 600;
}
.list { padding-bottom: 40rpx; }
.row {
  background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx;
  display: flex; justify-content: space-between; align-items: center; gap: 16rpx;
}
.row__main { min-width: 0; flex: 1; }
.row__top { display: flex; align-items: center; gap: 12rpx; flex-wrap: wrap; }
.row__label { display: block; font-weight: 700; }
.tag {
  font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 999rpx; font-weight: 700;
}
.tag--main { color: #0f766e; background: #ccfbf1; }
.tag--sub { color: #9a3412; background: #ffedd5; }
.time { display: block; margin-top: 6rpx; color: #94a3b8; font-size: 24rpx; }
.amt { text-align: right; flex-shrink: 0; max-width: 48%; }
.plus { color: #0f766e; font-weight: 700; }
.minus { color: #b91c1c; font-weight: 700; }
.amt-kind { margin-left: 6rpx; font-size: 22rpx; font-weight: 700; opacity: 0.85; }
.amt-tag { display: block; margin-top: 4rpx; font-size: 20rpx; font-weight: 600; color: #64748b; }
.empty, .fail { display: block; color: #64748b; padding: 20rpx 0; }
.fail { color: #b91c1c; font-weight: 700; }
</style>
