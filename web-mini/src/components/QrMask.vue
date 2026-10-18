<script setup lang="ts">
import { getCurrentInstance, nextTick, ref, watch } from 'vue';
import UQRCode from 'uqrcodejs';

const props = defineProps<{ visible: boolean; code: string }>();
const emit = defineEmits<{ close: [] }>();
const inst = getCurrentInstance();
let previousBrightness = 0.6;

watch(
  () => [props.visible, props.code] as const,
  async ([open, code]) => {
    if (!open || !code) {
      restoreBrightness();
      return;
    }
    raiseBrightness();
    await nextTick();
    const qr = new UQRCode();
    qr.data = code;
    qr.size = 220;
    qr.make();
    const ctx = uni.createCanvasContext('memberQr', inst?.proxy as never);
    qr.canvasContext = ctx;
    qr.drawCanvas();
  },
);

function raiseBrightness() {
  const getter = uni.getScreenBrightness;
  if (typeof getter !== 'function') return;
  getter({
    success(res) {
      previousBrightness = res.value;
    },
    complete() {
      uni.setScreenBrightness?.({ value: 1 });
    },
  });
}

function restoreBrightness() {
  if (typeof uni.setScreenBrightness === 'function') {
    uni.setScreenBrightness({ value: previousBrightness });
  }
}

function close() {
  restoreBrightness();
  emit('close');
}
</script>

<template>
  <view v-if="visible" class="mask" @tap="close">
    <view class="sheet" @tap.stop>
      <canvas canvas-id="memberQr" id="memberQr" class="qr" />
      <view class="code">{{ code }}</view>
      <view class="hint">请将此码出示给店员核销</view>
      <button class="share" open-type="share">分享给好友</button>
      <button class="close" @tap="close">关闭</button>
    </view>
  </view>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(2, 6, 23, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
}
.sheet {
  width: 560rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx 32rpx 32rpx;
  text-align: center;
}
.qr { width: 220px; height: 220px; margin: 0 auto; }
.code { margin-top: 12rpx; letter-spacing: 2rpx; color: #334155; }
.hint { margin-top: 16rpx; font-size: 32rpx; font-weight: 700; }
.share { margin-top: 24rpx; background: #ccfbf1; color: #0f766e; border-radius: 12rpx; font-weight: 700; }
.close { margin-top: 16rpx; background: #0f172a; color: #fff; border-radius: 12rpx; }
</style>
