<template>
  <div class="h5-login">
    <van-nav-bar title="登录" />

    <van-notice-bar
      left-icon="info-o"
      color="#92400e"
      background="#fffbeb"
      text="S5.1：C 端走微信登录（wx.login → code → openid）。本机无微信凭据时用「模拟 code」走通同一链路。"
    />

    <div class="h5-login__form">
      <van-field v-model="code" label="模拟 code" placeholder="dev-code-1001" clearable />
      <div class="h5-login__hint">
        未配置 WX_APPID/WX_SECRET 时，后端把 code 确定性地映射为 openid（dev_openid_&lt;code&gt;）。
        同一个 code 每次都登录同一个用户。
      </div>
      <van-button block type="primary" :loading="loading" @click="onLogin">微信登录</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { showFailToast, showSuccessToast } from 'vant';
import { h5Api } from '@/api/h5';
import { h5Auth } from '@/utils/h5Request';

const router = useRouter();
const code = ref('dev-code-1001');
const loading = ref(false);

async function onLogin() {
  if (!code.value.trim()) {
    showFailToast('请输入 code');
    return;
  }
  loading.value = true;
  try {
    const res = await h5Api.login(code.value.trim());
    h5Auth.set(res.accessToken, res.user);
    showSuccessToast(`登录成功：${res.user.nickname ?? res.user.phone}`);
    router.replace('/h5/exchange');
  } catch (e) {
    showFailToast((e as Error).message || '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.h5-login {
  min-height: 100vh;
  background: #f5f6f8;
}
.h5-login__form {
  padding: 16px;
}
.h5-login__hint {
  margin: 10px 0 16px;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.7;
}
</style>
