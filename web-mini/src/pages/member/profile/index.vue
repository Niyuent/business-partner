<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import AppTabBar from '@/components/AppTabBar.vue';
import EmptyState from '@/components/EmptyState.vue';
import { useSessionStore } from '@/stores/session';
import { loginMerchantAndRoute, MERCHANT_TEST_ACCOUNTS } from '@/services/auth';
import { fetchMe, fetchPointAccount } from '@/services/member';
import { friendlyMessage } from '@/utils/errors';
import { logoutToLogin } from '@/utils/logout';
import { rememberMember } from '@/utils/share';

const session = useSessionStore();
const loading = ref(true);
const name = ref('');
const avatar = ref('');
const balance = ref(0);
const errorText = ref('');

async function load() {
  loading.value = true;
  errorText.value = '';
  try {
    const [me, account] = await Promise.all([fetchMe(), fetchPointAccount()]);
    rememberMember(me.id);
    name.value = me.nickname || session.profileName || '会员';
    avatar.value = me.avatar || session.avatar || '';
    balance.value = account.summary?.available ?? account.account.balance;
    session.profileName = name.value;
    session.avatar = avatar.value;
  } catch (error) {
    errorText.value = friendlyMessage(error, '个人资料没有加载出来');
    name.value = session.profileName || '会员';
  } finally {
    loading.value = false;
  }
}

function go(url: string) {
  uni.navigateTo({ url });
}

function goWallet() {
  uni.reLaunch({ url: '/pages/member/wallet/index' });
}

const switching = ref('');

function logout() {
  logoutToLogin();
}

async function enterMerchant(username: string) {
  if (switching.value) return;
  switching.value = username;
  try {
    await loginMerchantAndRoute(username);
  } catch (error) {
    switching.value = '';
    uni.showToast({ title: friendlyMessage(error, '商家账号没有登录成功'), icon: 'none' });
  }
}

onShow(() => {
  session.hydrate();
  load();
});
</script>

<template>
  <view class="page">
    <view v-if="loading" class="skel" />
    <template v-else>
      <view v-if="errorText" class="fail">{{ errorText }}</view>
      <view class="head">
        <image v-if="avatar" class="avatar" :src="avatar" mode="aspectFill" />
        <view v-else class="avatar avatar--ph">{{ name.slice(0, 1) }}</view>
        <view class="name">{{ name }}</view>
      </view>
      <view class="logout" @tap="logout">退出登录</view>
      <view class="label">直接进入商家</view>
      <view
        v-for="item in MERCHANT_TEST_ACCOUNTS"
        :key="item.username"
        class="row"
        @tap="enterMerchant(item.username)"
      >
        <text>{{ item.label }} · {{ item.hint }}</text>
        <text>{{ switching === item.username ? '进入中' : '进入' }}</text>
      </view>
      <view class="row" @tap="go('/pages/member/points/index')">
        <text>我的积分</text><text>{{ balance }}</text>
      </view>
      <view class="row" @tap="goWallet">
        <text>我的卡包</text><text>查看</text>
      </view>
      <view class="block">
        <view class="block__title">消费记录</view>
        <empty-state title="还没有消费记录" hint="到店消费后，记录会出现在这里" />
      </view>
    </template>
    <app-tab-bar active="profile" />
  </view>
</template>

<style scoped>
.page { min-height: 100vh; padding: 40rpx 32rpx 180rpx; box-sizing: border-box; }
.head { display: flex; align-items: center; gap: 20rpx; margin-bottom: 28rpx; }
.avatar { width: 112rpx; height: 112rpx; border-radius: 50%; background: #0f766e; }
.avatar--ph { color: #fff; display: flex; align-items: center; justify-content: center; font-size: 44rpx; font-weight: 700; }
.name { font-size: 40rpx; font-weight: 700; }
.row { background: #fff; border-radius: 16rpx; padding: 28rpx 24rpx; margin-bottom: 16rpx; display: flex; justify-content: space-between; }
.block { background: #fff; border-radius: 16rpx; padding: 8rpx 8rpx 16rpx; margin-bottom: 16rpx; }
.block__title { padding: 20rpx 16rpx 0; font-weight: 700; }
.label { margin: 8rpx 0 12rpx; color: #64748b; font-size: 24rpx; }
.logout {
  margin: 8rpx 0 20rpx;
  background: #fff;
  color: #b91c1c;
  text-align: center;
  border-radius: 16rpx;
  padding: 28rpx 24rpx;
  font-weight: 700;
}
.fail { color: #b91c1c; font-weight: 700; margin-bottom: 16rpx; }
.skel { height: 220rpx; border-radius: 16rpx; background: #e2e8f0; }
</style>
