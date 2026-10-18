<script setup lang="ts">
import { ref } from 'vue';
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app';
import AppTabBar from '@/components/AppTabBar.vue';
import EmptyState from '@/components/EmptyState.vue';
import ListSkeleton from '@/components/ListSkeleton.vue';
import QrMask from '@/components/QrMask.vue';
import { useSessionStore } from '@/stores/session';
import { dayText, fetchMe, fetchMyCoupons, type CouponCard } from '@/services/member';
import { friendlyMessage } from '@/utils/errors';
import { enableShareMenu, memberSharePath, rememberMember } from '@/utils/share';

const session = useSessionStore();
const tabs = [
  { key: 'UNUSED', text: '未使用' },
  { key: 'USED', text: '已使用' },
  { key: 'EXPIRED', text: '已过期' },
] as const;
type Tab = (typeof tabs)[number]['key'];

const status = ref<Tab>('UNUSED');
const loading = ref(true);
const loadingMore = ref(false);
const refreshing = ref(false);
const errorText = ref('');
const list = ref<CouponCard[]>([]);
const page = ref(1);
const total = ref(0);
const qrCode = ref('');
const qrOpen = ref(false);
const pageSize = 10;

async function load(reset: boolean) {
  if (reset) {
    page.value = 1;
    loading.value = list.value.length === 0;
  } else {
    loadingMore.value = true;
  }
  errorText.value = '';
  try {
    const data = await fetchMyCoupons(status.value, reset ? 1 : page.value, pageSize);
    total.value = data.total;
    list.value = reset ? data.list : list.value.concat(data.list);
  } catch (error) {
    errorText.value = friendlyMessage(error, '卡包没有加载出来');
  } finally {
    loading.value = false;
    loadingMore.value = false;
    refreshing.value = false;
  }
}

function switchTab(next: Tab) {
  if (next === status.value) return;
  status.value = next;
  list.value = [];
  load(true);
}

function more() {
  if (loading.value || loadingMore.value || list.value.length >= total.value) return;
  page.value += 1;
  load(false);
}

function open(item: CouponCard) {
  if (status.value !== 'UNUSED' || !item.code) return;
  qrCode.value = item.code;
  qrOpen.value = true;
}

onShow(() => {
  session.hydrate();
  enableShareMenu();
  fetchMe().then((me) => rememberMember(me.id)).catch(() => undefined);
  load(true);
});

onShareAppMessage(() => ({
  title: '我的商盟卡包，邀请你一起领券',
  path: memberSharePath(),
}));

onShareTimeline(() => ({
  title: '我的商盟卡包，邀请你一起领券',
  query: memberSharePath().split('?')[1] || '',
}));
</script>

<template>
  <view class="page">
    <view class="tabs">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="tab"
        :class="{ 'is-on': status === tab.key }"
        @tap="switchTab(tab.key)"
      >{{ tab.text }}</view>
    </view>
    <scroll-view
      scroll-y
      class="list"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="refreshing = true; load(true)"
      @scrolltolower="more"
    >
      <list-skeleton v-if="loading" />
      <view v-else-if="errorText" class="fail">{{ errorText }}</view>
      <empty-state v-else-if="!list.length" title="这个分类里还没有券" hint="兑换或到店领取后，会出现在这里" />
      <view v-for="item in list" :key="item.id" class="card" @tap="open(item)">
        <view class="card__face">¥{{ item.faceValue }}</view>
        <view class="card__main">
          <view class="card__name">{{ item.name }}</view>
          <view class="card__date">有效期至 {{ dayText(item.expireAt) }}</view>
        </view>
      </view>
      <view v-if="loadingMore" class="more">加载更多…</view>
    </scroll-view>
    <qr-mask :visible="qrOpen" :code="qrCode" @close="qrOpen = false" />
    <app-tab-bar active="wallet" />
  </view>
</template>

<style scoped>
.page { min-height: 100vh; padding: 24rpx 32rpx 0; box-sizing: border-box; }
.tabs { display: flex; background: #fff; border-radius: 16rpx; overflow: hidden; }
.tab { flex: 1; text-align: center; padding: 20rpx 0; color: #64748b; }
.tab.is-on { color: #0f766e; font-weight: 700; background: #ccfbf1; }
.list { height: calc(100vh - 280rpx); margin-top: 20rpx; }
.card { display: flex; background: #fff; border-radius: 16rpx; overflow: hidden; margin-bottom: 16rpx; min-height: 140rpx; }
.card__face { width: 170rpx; background: #0f766e; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 44rpx; font-weight: 700; }
.card__main { padding: 24rpx; }
.card__name { font-weight: 700; }
.card__date { margin-top: 8rpx; color: #64748b; font-size: 24rpx; }
.empty, .more { text-align: center; color: #64748b; padding: 24rpx 0; }
.fail { color: #b91c1c; font-weight: 700; padding: 24rpx 0; }
.skel { height: 140rpx; border-radius: 16rpx; background: #e2e8f0; }
</style>
