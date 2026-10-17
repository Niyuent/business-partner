<script setup lang="ts">
/**
 * 站内信铃铛（S5.4-B2 第 6 步填充）
 *
 * 目前是**空占位**：先挂进 AdminLayout 的 header-right，确定插槽位置与样式钩子
 * （外层已有 `.layout__bell` 样式），第 6 步再填：
 *  - `notificationApi.unreadCount()` 拉未读数 → 红点徽标
 *  - 点击弹出最近 N 条未读 + 「全部已读」+ 跳 `/main/notifications?tab=inbox`
 *
 * 注意：不在这里做定时轮询（第 6 步统一用 SSE / 手动刷新，避免每个页面都在打接口）。
 */
</script>

<template>
  <!-- 占位：第 6 步在此渲染铃铛图标 + 未读徽标 + 下拉面板 -->
</template>
