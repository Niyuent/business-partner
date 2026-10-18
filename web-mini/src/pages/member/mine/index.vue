<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';

onShow(() => {
  uni.reLaunch({ url: '/pages/member/profile/index' });
});
</script>
<template><view /></template>
