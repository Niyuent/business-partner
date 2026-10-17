<template>
  <div class="layout">
    <el-aside :width="appStore.sidebarCollapsed ? '64px' : '220px'" class="layout__aside">
      <div class="layout__logo">
        <span v-if="!appStore.sidebarCollapsed">商盟系统</span>
        <span v-else>商</span>
      </div>
      <el-menu
        :default-active="route.path"
        :collapse="appStore.sidebarCollapsed"
        :collapse-transition="false"
        router
        unique-opened
        background-color="#1f2937"
        text-color="#cbd5e1"
        active-text-color="#ffd04b"
      >
        <template v-for="item in menuRoutes" :key="item.path">
          <el-sub-menu v-if="item.children?.length" :index="item.path">
            <template #title>
              <el-icon><component :is="item.meta?.icon" /></el-icon>
              <span>{{ item.meta?.title }}</span>
            </template>
            <el-menu-item v-for="child in item.children" :key="child.path" :index="`${item.path}/${child.path}`">
              {{ child.meta?.title }}
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="item.path">
            <el-icon><component :is="item.meta?.icon" /></el-icon>
            <template #title>{{ item.meta?.title }}</template>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>

    <div class="layout__main">
      <header class="layout__header">
        <div class="layout__header-left">
          <el-icon class="layout__toggle" @click="appStore.toggleSidebar()">
            <component :is="appStore.sidebarCollapsed ? 'Expand' : 'Fold'" />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="route.meta.title">{{ route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="layout__header-right">
          <!-- 站内信铃铛：S5.4-B2 第 6 步填充（未读数徽标 + 下拉面板） -->
          <NotificationBell />
          <el-tag size="small" :type="userStore.isMainMerchant ? 'warning' : 'success'">
            {{ userStore.isMainMerchant ? '主体商家' : userStore.profile?.store?.name || userStore.profile?.merchant?.name || '附属商家' }}
          </el-tag>
          <el-dropdown @command="onCommand">
            <span class="layout__user">
              {{ userStore.profile?.realName || userStore.profile?.username }}
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="layout__content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter, type RouteRecordRaw } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { useAppStore } from '@/stores/app';
import { useUserStore } from '@/stores/user';
import NotificationBell from '@/components/NotificationBell.vue';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const userStore = useUserStore();

/**
 * 菜单可见性 = 路由 meta.permission 是否命中当前账号权限码。
 * 后端仍会二次校验（RolesGuard + 数据可见范围），这里只负责「不该看到就别让用户点」。
 */
const menuRoutes = computed(() => {
  const root = router.options.routes.find((r) => r.path === '/');
  const list = (root?.children ?? []) as RouteRecordRaw[];
  return list.filter((r) => {
    if (r.meta?.hidden) return false;
    const permission = r.meta?.permission as string | undefined;
    if (permission && !userStore.hasPermission(permission)) return false;
    return true;
  });
});

function onCommand(cmd: string) {
  if (cmd === 'profile') {
    router.push('/profile');
  } else if (cmd === 'logout') {
    ElMessageBox.confirm('确认退出登录？', '提示', { type: 'warning' }).then(() => {
      userStore.logout();
      router.push('/login');
    });
  }
}
</script>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.layout__aside {
  background: #1f2937;
  transition: width 0.2s;
  overflow-x: hidden;
}
.layout__logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  letter-spacing: 2px;
  background: #111827;
}
.layout__aside :deep(.el-menu) {
  border-right: none;
}
.layout__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.layout__header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}
.layout__header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.layout__header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.layout__toggle {
  font-size: 20px;
  cursor: pointer;
}
.layout__bell {
  cursor: pointer;
}
.layout__user {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.layout__content {
  flex: 1;
  overflow: auto;
  padding: 16px;
  background: #f5f7fa;
}
</style>
