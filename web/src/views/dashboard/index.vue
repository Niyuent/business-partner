<template>
  <div class="dashboard">
    <el-alert
      type="success"
      show-icon
      :closable="false"
      title="后端已接真接口（Mock 已关闭）"
      description="登录、菜单权限、按钮权限、入驻审核 / 商家管理 / 授权管理 / 操作日志 均已对接真实后端 /api/v1/*。工作台指标与图表属于 S4 报表阶段，届时再接入。"
      class="dashboard__row"
    />

    <el-row :gutter="16" class="dashboard__row">
      <el-col :span="16">
        <el-card shadow="never">
          <template #header>近 7 日趋势（订单 / 核销 / 兑换）</template>
          <div class="dashboard__chart">图表将在 S4 报表阶段接入 ECharts</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <template #header>快捷入口</template>
          <div class="dashboard__links">
            <el-button v-permission="'merchant:audit'" @click="$router.push('/main/merchant-applications')">
              入驻审核
            </el-button>
            <el-button v-permission="'merchant:view'" @click="$router.push('/main/merchants')">商家管理</el-button>
            <el-button v-permission="'authorization:view'" @click="$router.push('/main/authorizations')">
              授权管理
            </el-button>
            <el-button v-permission="'audit:view'" @click="$router.push('/main/audit-logs')">操作日志</el-button>
          </div>
          <div class="dashboard__hint">
            按钮同样受 <b>v-permission</b> 控制：没有对应权限码的角色连入口都看不到。
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.dashboard__row {
  margin-top: 16px;
}
.dashboard__chart {
  height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}
.dashboard__links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.dashboard__hint {
  margin-top: 16px;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.8;
}
</style>
