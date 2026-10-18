<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import AppTabBar from '@/components/AppTabBar.vue';
import EmptyState from '@/components/EmptyState.vue';
import ListSkeleton from '@/components/ListSkeleton.vue';
import { useSessionStore } from '@/stores/session';
import { exchangeCoupon, fetchCouponTemplates, fetchMe, type CouponTemplate } from '@/services/member';
import { friendlyMessage } from '@/utils/errors';
import { HttpError } from '@/utils/request';
import { rememberMember } from '@/utils/share';
import { grantSubscribe } from '@/utils/subscribe';

const session = useSessionStore();
const loading = ref(true);
const loadingMore = ref(false);
const refreshing = ref(false);
const errorText = ref('');
const list = ref<CouponTemplate[]>([]);
const page = ref(1);
const total = ref(0);
const userId = ref(0);
const pageSize = 10;

async function load(reset: boolean) {
  if (reset) page.value = 1;
  else loadingMore.value = true;
  if (reset && !list.value.length) loading.value = true;
  errorText.value = '';
  try {
    const [me, data] = await Promise.all([
      reset ? fetchMe() : Promise.resolve(null),
      fetchCouponTemplates(reset ? 1 : page.value, pageSize),
    ]);
    if (me) {
      userId.value = me.id;
      rememberMember(me.id);
    }
    total.value = data.total;
    list.value = reset ? data.list : list.value.concat(data.list);
  } catch (error) {
    errorText.value = friendlyMessage(error, '券列表没有加载出来');
  } finally {
    loading.value = false;
    loadingMore.value = false;
    refreshing.value = false;
  }
}

function more() {
  if (loading.value || loadingMore.value || list.value.length >= total.value) return;
  page.value += 1;
  load(false);
}

function ask(item: CouponTemplate) {
  uni.showModal({
    title: '确认兑换',
    content: `确认消耗 ${item.pointsCost} 积分兑换此券吗？`,
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await exchangeCoupon({
          userId: userId.value,
          templateId: item.id,
          requestId: `ex${Date.now()}${Math.floor(Math.random() * 1000)}`,
        });
        uni.showModal({
          title: '兑换成功，已存入卡包',
          content: '可以去卡包亮码。打开服务通知后，发券或快过期时会提醒你。',
          confirmText: '允许接收通知',
          cancelText: '去卡包',
          success(next) {
            if (next.confirm) grantSubscribe('exchange');
            else uni.reLaunch({ url: '/pages/member/wallet/index' });
          },
        });
      } catch (error) {
        const text = error instanceof HttpError && error.reasonCode === 'BALANCE_NOT_ENOUGH'
          ? '积分不够哦'
          : friendlyMessage(error, '兑换没有完成');
        uni.showToast({ title: text, icon: 'none' });
      }
    },
  });
}

onShow(() => {
  session.hydrate();
  load(true);
});
</script>

<template>
  <view class="page">
    <view class="title">积分商城</view>
    <view class="group">满减券和代金券</view>
    <scroll-view
      scroll-y
      class="list"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="refreshing = true; load(true)"
      @scrolltolower="more"
    >
      <list-skeleton v-if="loading" :count="4" />
      <view v-else-if="errorText" class="fail">{{ errorText }}</view>
      <empty-state v-else-if="!list.length" title="暂时没有可兑换的券" hint="上架新券后会出现在这里" />
      <view v-for="item in list" :key="item.id" class="coupon" @tap="ask(item)">
        <view class="coupon__art">¥{{ item.faceValue }}</view>
        <view class="coupon__main">
          <view class="coupon__name">{{ item.name }}</view>
          <view class="coupon__meta">
            {{ item.thresholdAmount > 0 ? `满 ${item.thresholdAmount} 可用` : '无门槛' }} · {{ item.pointsCost }} 积分
          </view>
        </view>
      </view>
      <view v-if="loadingMore" class="more">加载更多…</view>
    </scroll-view>
    <app-tab-bar active="mall" />
  </view>
</template>

<style scoped>
.page { min-height: 100vh; padding: 32rpx 32rpx 0; box-sizing: border-box; }
.title { font-size: 40rpx; font-weight: 700; }
.group { margin: 12rpx 0 16rpx; color: #64748b; }
.list { height: calc(100vh - 320rpx); }
.coupon { display: flex; background: #fff; border-radius: 16rpx; overflow: hidden; margin-bottom: 16rpx; min-height: 140rpx; }
.coupon__art { width: 170rpx; background: #fef3c7; color: #92400e; display: flex; align-items: center; justify-content: center; font-size: 40rpx; font-weight: 700; }
.coupon__main { padding: 24rpx; }
.coupon__name { font-weight: 700; }
.coupon__meta { margin-top: 8rpx; color: #64748b; font-size: 24rpx; }
.empty, .more { text-align: center; color: #64748b; padding: 20rpx 0; }
.fail { color: #b91c1c; font-weight: 700; }
.skel { height: 160rpx; background: #e2e8f0; border-radius: 16rpx; }
</style>
