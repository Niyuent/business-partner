import { cancelPendingLogin } from '@/services/auth';
import { useSessionStore } from '@/stores/session';

export function logoutToLogin() {
  cancelPendingLogin();
  try {
    useSessionStore().clear();
  } catch {
    uni.removeStorageSync('mini_token');
    uni.removeStorageSync('mini_role');
  }
  const jump = () => {
    uni.reLaunch({ url: '/pages/login/index' });
  };
  const native = (globalThis as { wx?: { reLaunch?: (opts: { url: string }) => void } }).wx;
  if (typeof native?.reLaunch === 'function') native.reLaunch({ url: '/pages/login/index' });
  else jump();
}
