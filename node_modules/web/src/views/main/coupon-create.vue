<template>
  <div class="page">
    <el-card shadow="never">
      <template #header>
        <div class="page__head">
          <span>创建券模板</span>
          <el-button link @click="$router.push('/main/coupons')">返回列表</el-button>
        </div>
      </template>

      <el-alert
        type="info"
        show-icon
        :closable="false"
        title="H1 硬约束：只有主体商家可以创建券模板"
        description="creatorMerchantId 由后端按登录账号所属主体自动写入，前端不传也不能传；创建后固定为草稿（DRAFT），需要上架后才能被发放。"
        class="page__alert"
      />

      <CouponForm :submitting="submitting" @submit="onCreate" @cancel="$router.push('/main/coupons')" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import CouponForm from './coupon-form.vue';
import { couponTemplateApi } from '@/api/coupon-template';
import type { CreateCouponTemplatePayload } from '@/types/business';

const router = useRouter();
const submitting = ref(false);

async function onCreate(payload: CreateCouponTemplatePayload) {
  submitting.value = true;
  try {
    const res = await couponTemplateApi.create(payload);
    ElMessage.success(`券模板 #${res.template.id} 已创建（草稿）`);
    router.push(`/main/coupons/${res.template.id}`);
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.page__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.page__alert {
  margin-bottom: 20px;
}
</style>
