<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import NetworkBanner from '@/components/NetworkBanner.vue';
import { MEMBER_TABS, MERCHANT_TABS, useSessionStore, type MiniRole } from '@/stores/session';

const props = defineProps<{
  active: string;
}>();

const session = useSessionStore();
const { role, tabs } = storeToRefs(session);

interface TabItem {
  key: string;
  text: string;
  url: string;
}

const catalog: Record<string, { text: string; member: string; merchant: string }> = {
  home: { text: '首页', member: '/pages/member/home/index', merchant: '/pages/member/home/index' },
  wallet: { text: '卡包', member: '/pages/member/wallet/index', merchant: '/pages/member/wallet/index' },
  mall: { text: '积分商城', member: '/pages/member/mall/index', merchant: '/pages/member/mall/index' },
  workbench: { text: '工作台', member: '/pages/merchant/workbench/index', merchant: '/pages/merchant/workbench/index' },
  verify: { text: '核销', member: '/pages/merchant/verify/index', merchant: '/pages/merchant/verify/index' },
  notification: { text: '通知', member: '/pages/merchant/notice/index', merchant: '/pages/merchant/notice/index' },
  profile: { text: '我的', member: '/pages/member/profile/index', merchant: '/pages/merchant/mine/index' },
};

const keys = computed(() => {
  if (tabs.value.length) return tabs.value;
  if (role.value === 'merchant') return [...MERCHANT_TABS];
  if (role.value === 'member') return [...MEMBER_TABS];
  return [];
});

const items = computed<TabItem[]>(() => {
  const side: MiniRole = role.value === 'merchant' ? 'merchant' : 'member';
  return keys.value
    .map((key) => {
      const item = catalog[key];
      if (!item) return null;
      return { key, text: item.text, url: item[side] };
    })
    .filter((item): item is TabItem => item !== null);
});

const accent = computed(() => (role.value === 'merchant' ? '#1d4ed8' : '#0f766e'));

function go(item: TabItem) {
  if (item.key === props.active) return;
  uni.reLaunch({ url: item.url });
}
</script>

<template>
  <view>
  <network-banner />
  <view class="tabbar" :style="{ '--accent': accent }">
    <view class="tabbar__tag">{{ role === 'merchant' ? '商家端' : '会员端' }}</view>
    <view
      v-for="item in items"
      :key="item.key"
      class="tabbar__item"
      :class="{ 'is-active': item.key === active }"
      @tap="go(item)"
    >
      <text class="tabbar__text">{{ item.text }}</text>
    </view>
  </view>
  </view>
</template>

<style scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: stretch;
  height: 112rpx;
  padding-bottom: env(safe-area-inset-bottom);
  background: #ffffff;
  border-top: 1px solid #e2e8f0;
  box-shadow: 0 -8rpx 24rpx rgba(15, 23, 42, 0.04);
}
.tabbar__tag {
  position: absolute;
  top: -36rpx;
  left: 24rpx;
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  background: var(--accent);
  color: #fff;
  font-size: 20rpx;
  line-height: 32rpx;
}
.tabbar__item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
}
.tabbar__item.is-active {
  color: var(--accent);
  font-weight: 600;
}
.tabbar__text {
  font-size: 26rpx;
}
</style>
