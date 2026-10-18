<script setup lang="ts">
import { ref } from 'vue';
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app';
import AppTabBar from '@/components/AppTabBar.vue';
import { useSessionStore } from '@/stores/session';
import { fetchCouponTemplates, fetchMe, fetchPointAccount, type CouponTemplate } from '@/services/member';
import { friendlyMessage } from '@/utils/errors';
import { acceptInviteQuery, enableShareMenu, memberSharePath, rememberMember } from '@/utils/share';

const session = useSessionStore();
const loading = ref(true);
const errorText = ref('');
const balance = ref(0);
const expiring = ref(0);
const coupons = ref<CouponTemplate[]>([]);

async function load() {
  loading.value = true;
  errorText.value = '';
  try {
    const [account, templates, me] = await Promise.all([
      fetchPointAccount(),
      fetchCouponTemplates(1, 6),
      fetchMe().catch(() => null),
    ]);
    if (me) rememberMember(me.id);
    balance.value = account.summary?.available ?? account.account.balance;
    expiring.value = account.summary?.expiringSoon ?? 0;
    coupons.value = templates.list || [];
  } catch (error) {
    errorText.value = friendlyMessage(error, '首页数据没有加载出来');
  } finally {
    loading.value = false;
  }
}

function go(url: string) {
  uni.navigateTo({ url });
}

function openMall() {
  uni.navigateTo({ url: '/pages/member/mall/index' });
}

onLoad((query) => {
  const { invite } = acceptInviteQuery(query);
  if (invite) uni.showToast({ title: '已收到好友邀请', icon: 'none' });
});

onShow(() => {
  session.hydrate();
  enableShareMenu();
  load();
});

onShareAppMessage(() => ({
  title: '来商盟领券，积分当钱花',
  path: memberSharePath(),
}));

onShareTimeline(() => ({
  title: '来商盟领券，积分当钱花',
  query: memberSharePath().split('?')[1] || '',
}));
</script>

<template>
  <view class="page">
    <view v-if="loading" class="skel">
      <view class="skel__hero" />
      <view class="skel__banner" />
      <view class="skel__row" />
      <view class="skel__row" />
    </view>
    <template v-else>
      <view v-if="errorText" class="fail">{{ errorText }}</view>
      <view class="hero">
        <view class="hero__label">当前积分余额</view>
        <view class="hero__num">{{ balance }}</view>
        <view class="hero__sub">本月即将过期 {{ expiring }} 分</view>
      </view>
      <view class="banner">到店亮码，积分当钱花</view>
      <view class="shortcuts">
        <view class="shortcut" @tap="go('/pages/member/points/index')">积分明细</view>
        <view class="shortcut" @tap="go('/pages/member/wallet/index')">我的卡包</view>
        <button class="shortcut shortcut--share" open-type="share">分享</button>
      </view>
      <view class="section">推荐好券</view>
      <view v-if="!coupons.length" class="empty">暂时没有可兑换的券</view>
      <view v-for="item in coupons" :key="item.id" class="coupon" @tap="openMall">
        <view class="coupon__face">¥{{ item.faceValue }}</view>
        <view class="coupon__main">
          <view class="coupon__name">{{ item.name }}</view>
          <view class="coupon__meta">{{ item.pointsCost }} 积分 · 剩余 {{ item.remainingStock }}</view>
        </view>
      </view>
    </template>
    <app-tab-bar active="home" />
  </view>
</template>

<style scoped>
.page { min-height: 100vh; padding: 32rpx 32rpx 180rpx; box-sizing: border-box; }
.hero { background: #0f766e; color: #fff; border-radius: 24rpx; padding: 36rpx 32rpx; }
.hero__label { font-size: 26rpx; opacity: 0.85; }
.hero__num { font-size: 84rpx; font-weight: 700; line-height: 1.1; }
.hero__sub { margin-top: 8rpx; font-size: 24rpx; opacity: 0.9; }
.banner {
  margin-top: 24rpx; height: 160rpx; border-radius: 20rpx;
  background: linear-gradient(120deg, #134e4a, #0f766e 55%, #5eead4);
  color: #fff; display: flex; align-items: center; padding-left: 32rpx; font-size: 34rpx; font-weight: 700;
}
.shortcuts { display: flex; gap: 16rpx; margin-top: 24rpx; }
.shortcut { flex: 1; background: #fff; text-align: center; padding: 24rpx 0; border-radius: 16rpx; font-weight: 600; line-height: 1.4; }
.shortcut--share { margin: 0; font-size: 28rpx; color: #0f172a; }
.section { margin: 28rpx 0 12rpx; font-size: 32rpx; font-weight: 700; }
.coupon { display: flex; background: #fff; border-radius: 16rpx; overflow: hidden; margin-bottom: 16rpx; }
.coupon__face { width: 160rpx; background: #ccfbf1; color: #0f766e; display: flex; align-items: center; justify-content: center; font-size: 40rpx; font-weight: 700; }
.coupon__main { padding: 24rpx; }
.coupon__name { font-weight: 700; }
.coupon__meta { margin-top: 8rpx; color: #64748b; font-size: 24rpx; }
.empty, .fail { margin-top: 20rpx; color: #64748b; }
.fail { color: #b91c1c; font-weight: 700; }
.skel__hero, .skel__banner, .skel__row { background: #e2e8f0; border-radius: 16rpx; }
.skel__hero { height: 220rpx; }
.skel__banner { height: 160rpx; margin-top: 20rpx; }
.skel__row { height: 120rpx; margin-top: 20rpx; }
</style>
