<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShareAppMessage, onShow } from '@dcloudio/uni-app';
import AppTabBar from '@/components/AppTabBar.vue';
import { useSessionStore } from '@/stores/session';
import { fetchFinance, fetchWorkbench, type FinanceCheckup, type WorkbenchData } from '@/services/merchant';
import { friendlyMessage } from '@/utils/errors';
import { applyPageUrl, applySharePath, enableShareMenu, merchantInviteCode } from '@/utils/share';

const session = useSessionStore();
const loading = ref(true);
const errorText = ref('');
const desk = ref<WorkbenchData | null>(null);
const finance = ref<FinanceCheckup | null>(null);
const inviteOpen = ref(false);
const inviteCode = computed(() => merchantInviteCode(desk.value?.merchantId));

async function load() {
  loading.value = true;
  errorText.value = '';
  try {
    const [workbench, checkup] = await Promise.all([fetchWorkbench(), fetchFinance()]);
    desk.value = workbench;
    finance.value = checkup;
    if (workbench.storeId) uni.setStorageSync('mini_store_id', workbench.storeId);
  } catch (error) {
    errorText.value = friendlyMessage(error, '生意数据暂时没有加载出来');
  } finally {
    loading.value = false;
  }
}

function go(url: string) {
  uni.navigateTo({ url });
}

function copyInvite() {
  // 微信里由 open-type="share" 拉起分享卡片；浏览器里改成复制入驻链接。
  // #ifdef H5
  uni.setClipboardData({
    data: applyPageUrl(inviteCode.value),
    success() {
      uni.showToast({ title: '申请链接已复制', icon: 'none' });
    },
  });
  // #endif
}

function guideFinance() {
  uni.showModal({
    title: '完善财务数据',
    content: '近 30 天还没有可计算的经营流水。补上订单和核销后，就能看到健康分和现金支撑月数。',
    showCancel: false,
  });
}

onShow(() => {
  session.hydrate();
  enableShareMenu();
  load();
});

onShareAppMessage(() => ({
  title: `${desk.value?.merchantName || '商盟'}邀请你入驻`,
  path: applySharePath(inviteCode.value),
}));
</script>

<template>
  <view class="page">
    <view v-if="loading" class="skel">
      <view class="skel__line skel__line--lg" />
      <view class="skel__line" />
      <view class="skel__row">
        <view class="skel__card" />
        <view class="skel__card" />
      </view>
      <view class="skel__block" />
    </view>

    <template v-else>
      <view v-if="errorText" class="banner">{{ errorText }}</view>
      <view class="hello">{{ desk?.greeting }}，{{ desk?.bossName }}</view>
      <view class="store">{{ desk?.storeName }}</view>

      <view class="stats">
        <view class="stat">
          <view class="stat__num">{{ desk?.today.redemptions ?? 0 }}</view>
          <view class="stat__label">今日核销笔数</view>
        </view>
        <view class="stat">
          <view class="stat__num">{{ desk?.today.pointsIssued ?? 0 }}</view>
          <view class="stat__label">今日发放积分</view>
        </view>
      </view>

      <view class="finance">
        <view class="finance__title">财务诊断</view>
        <template v-if="finance?.has_data">
          <view class="finance__score">{{ finance.score }}<text class="finance__unit">分</text></view>
          <view class="finance__cash">
            现金支撑
            <text v-if="finance.cash_months != null">{{ finance.cash_months }} 个月</text>
            <text v-else>暂无让利支出，先不估算</text>
          </view>
        </template>
        <template v-else>
          <view class="finance__empty">近 30 天还没有足够的经营流水</view>
          <button class="guide" @tap="guideFinance">完善财务数据，获取 AI 经营建议</button>
        </template>
      </view>

      <view class="actions">
        <button class="action" @tap="go('/pages/merchant/verify/index')">扫码核销</button>
        <button class="action action--ghost" @tap="go('/pages/merchant/earn/index')">录单发积分</button>
      </view>
      <button class="invite" @tap="inviteOpen = true">邀请入驻</button>
    </template>

    <view v-if="inviteOpen" class="mask" @tap="inviteOpen = false">
      <view class="sheet" @tap.stop>
        <view class="sheet__title">邀请入驻</view>
        <view class="sheet__code">{{ inviteCode || '生成中' }}</view>
        <view class="sheet__hint">把这张卡片发给其他老板，对方打开后进入入驻申请页。</view>
        <button class="action" open-type="share" @tap="copyInvite">发送给其他老板</button>
        <button class="action action--ghost" @tap="go('/pages/apply/index?invite=' + inviteCode)">预览申请页</button>
      </view>
    </view>
    <app-tab-bar active="workbench" />
  </view>
</template>

<style scoped>
.page { min-height: 100vh; padding: 40rpx 32rpx 180rpx; box-sizing: border-box; }
.hello { font-size: 44rpx; font-weight: 700; }
.store { margin-top: 8rpx; color: #64748b; }
.stats { display: flex; gap: 20rpx; margin-top: 32rpx; }
.stat { flex: 1; background: #fff; border-radius: 20rpx; padding: 28rpx 24rpx; }
.stat__num { font-size: 56rpx; font-weight: 700; color: #0f172a; }
.stat__label { margin-top: 8rpx; color: #64748b; font-size: 24rpx; }
.finance { margin-top: 24rpx; background: #0f172a; color: #fff; border-radius: 24rpx; padding: 32rpx; }
.finance__title { font-size: 24rpx; color: #94a3b8; }
.finance__score { margin-top: 12rpx; font-size: 88rpx; font-weight: 700; line-height: 1; }
.finance__unit { font-size: 32rpx; margin-left: 8rpx; }
.finance__cash { margin-top: 16rpx; color: #cbd5e1; }
.finance__empty { margin: 16rpx 0 24rpx; line-height: 1.6; }
.guide { background: #fff; color: #0f172a; border-radius: 12rpx; font-size: 28rpx; }
.actions { display: flex; gap: 20rpx; margin-top: 28rpx; }
.action { flex: 1; background: #1d4ed8; color: #fff; border-radius: 16rpx; font-size: 30rpx; }
.action--ghost { background: #fff; color: #1d4ed8; }
.invite { margin-top: 20rpx; background: #fff; color: #0f172a; border-radius: 16rpx; }
.mask { position: fixed; inset: 0; background: rgba(15, 23, 42, .45); z-index: 30; display: flex; align-items: flex-end; }
.sheet { width: 100%; background: #fff; border-radius: 28rpx 28rpx 0 0; padding: 36rpx 32rpx 48rpx; box-sizing: border-box; }
.sheet__title { font-size: 34rpx; font-weight: 700; }
.sheet__code { margin-top: 16rpx; font-size: 56rpx; font-weight: 700; letter-spacing: 2rpx; color: #1d4ed8; }
.sheet__hint { margin: 12rpx 0 24rpx; color: #64748b; line-height: 1.6; }
.banner { margin-bottom: 20rpx; padding: 16rpx 20rpx; background: #fee2e2; color: #991b1b; border-radius: 12rpx; }
.skel__line, .skel__card, .skel__block { background: #e2e8f0; border-radius: 12rpx; }
.skel__line { height: 36rpx; width: 46%; margin-bottom: 16rpx; }
.skel__line--lg { width: 70%; height: 52rpx; }
.skel__row { display: flex; gap: 20rpx; margin-top: 20rpx; }
.skel__card { flex: 1; height: 160rpx; }
.skel__block { height: 220rpx; margin-top: 20rpx; }
</style>
