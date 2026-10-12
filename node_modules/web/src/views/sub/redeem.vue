<template>
  <div class="page">
    <el-card shadow="never">
      <template #header>
        <div class="page__head">
          <span>代金券核销</span>
          <el-tag v-if="fixedStore" size="small" type="info">
            核销门店：{{ fixedStore.name }}（账号绑定，不可切换）
          </el-tag>
        </div>
      </template>

      <el-form label-width="120px" class="page__form">
        <el-form-item label="券码" required>
          <el-input
            v-model="form.code"
            placeholder="请输入 12 位券码，如 DRKQ4P393MJA"
            style="width: 320px"
            maxlength="12"
            @keyup.enter="onVerify"
          />
          <span class="page__hint">字符集不含 0/O/1/I/L，末位为校验位</span>
        </el-form-item>

        <el-form-item v-if="!fixedStore" label="核销门店" required>
          <el-select v-model="form.storeId" placeholder="请选择门店" style="width: 260px">
            <el-option v-for="s in stores" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="订单号" required>
          <el-input v-model="form.orderNo" placeholder="如 ORD20260101099" style="width: 260px" />
        </el-form-item>

        <el-form-item label="订单金额">
          <el-input-number v-model="form.orderAmount" :min="0" :precision="2" :step="10" />
          <span class="page__hint">用于校验满减门槛（无门槛券可不填）</span>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="verifying" @click="onVerify">校验</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 校验结果：可核销 / 不可核销（含逐项明细） -->
      <template v-if="outcome">
        <el-divider content-position="left">校验结果</el-divider>

        <el-alert
          v-if="canRedeem"
          type="success"
          show-icon
          :closable="false"
          title="该券可以核销"
        />
        <el-alert
          v-else-if="fail"
          type="error"
          show-icon
          :closable="false"
          :title="`不可核销：${fail.reasonCode || 'UNKNOWN'}（HTTP ${fail.status}）`"
          :description="fail.message"
        />

        <el-descriptions v-if="coupon" :column="2" border size="small" class="page__desc">
          <el-descriptions-item label="券码">{{ coupon.code }}</el-descriptions-item>
          <el-descriptions-item label="券模板">{{ coupon.templateName }}</el-descriptions-item>
          <el-descriptions-item label="面值">{{ coupon.faceValue }} 元</el-descriptions-item>
          <el-descriptions-item label="使用门槛">
            {{ coupon.thresholdAmount > 0 ? `满 ${coupon.thresholdAmount} 元可用` : '无门槛' }}
          </el-descriptions-item>
          <el-descriptions-item label="持有用户">
            {{ coupon.userName }}（{{ coupon.userPhone }}）
          </el-descriptions-item>
          <el-descriptions-item label="有效期至">{{ formatDateTime(coupon.expireAt) }}</el-descriptions-item>
          <el-descriptions-item label="券状态">
            <el-tag size="small" :type="couponInstanceStatusTagType(coupon.status as never)">
              {{ couponInstanceStatusLabel(coupon.status as never) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="适用范围">
            {{
              coupon.applyScope === 'ALL_STORES'
                ? '全部门店'
                : coupon.stores.map((s) => s.name).join('、') || '—'
            }}
          </el-descriptions-item>
          <el-descriptions-item label="本次抵扣">{{ verifyData?.discountAmount ?? '-' }} 元</el-descriptions-item>
          <el-descriptions-item label="核销门店">{{ verifyData?.store?.name ?? '-' }}</el-descriptions-item>
        </el-descriptions>

        <el-table :data="checks" border size="small" class="page__checks">
          <el-table-column label="校验项" min-width="160" prop="item" />
          <el-table-column label="结果" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="row.passed ? 'success' : 'danger'">
                {{ row.passed ? '通过' : '不通过' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="原因" min-width="240">
            <template #default="{ row }">{{ row.message || row.reasonCode || '-' }}</template>
          </el-table-column>
        </el-table>

        <div v-if="canRedeem" class="page__actions">
          <el-button type="danger" :loading="redeeming" @click="onRedeem">确认核销</el-button>
          <span class="page__hint">核销后不可撤销（如需退回请到核销记录里冲正）</span>
        </div>
      </template>

      <!-- 核销成功 -->
      <template v-if="done">
        <el-divider content-position="left">核销完成</el-divider>
        <el-result icon="success" :title="`核销成功，抵扣 ${done.discountAmount} 元`">
          <template #sub-title>
            记录 #{{ done.id }} · 券码 {{ done.code }} · 门店 {{ done.storeId }} · 订单号 {{ form.orderNo }}
          </template>
        </el-result>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { authApi } from '@/api/auth';
import { redemptionApi, type VerifyOutcome } from '@/api/redemption';
import request from '@/utils/request';
import type { RedemptionRecord, StoreBrief, VerifyCouponResult } from '@/types/business';
import {
  couponInstanceStatusLabel,
  couponInstanceStatusTagType,
  formatDateTime,
} from '@/utils/dict';

/**
 * 核销页（S2.3）
 *
 * 流程严格按「先 verify 后执行」：输码 → verify（只读）→ 展示券信息与逐项检查 → 确认 → 执行核销。
 * verify 失败时后端返回 409/403/404 **并且**在 data 里带回券信息与 checks，
 * 所以这里即使失败也能告诉店员「这张券是什么、卡在哪一步」，而不是一句「校验失败」。
 */

const form = reactive({
  code: '',
  storeId: undefined as number | undefined,
  orderNo: '',
  orderAmount: undefined as number | undefined,
});

const stores = ref<StoreBrief[]>([]);
const fixedStore = ref<{ id: number; name: string } | null>(null);
const verifying = ref(false);
const redeeming = ref(false);
const outcome = ref<VerifyOutcome | null>(null);
const done = ref<RedemptionRecord | null>(null);

// verify 无论成功失败都会带回券信息与逐项明细（失败时是 409/403/404 + detail）
const verifyData = computed<Partial<VerifyCouponResult> | null>(() => outcome.value?.data ?? null);
const canRedeem = computed(
  () => outcome.value?.ok === true && outcome.value.data.redeemable === true,
);
const fail = computed(() => (outcome.value && outcome.value.ok === false ? outcome.value : null));
const coupon = computed<VerifyCouponResult['coupon']>(() => verifyData.value?.coupon ?? null);
const checks = computed(() => verifyData.value?.checks ?? []);

async function loadStoreOptions() {
  const profile = await authApi.profile();
  if (profile.store) {
    // 店员：门店由账号固定，后端也会用 JWT 的 storeId 兜底，前端不允许切换
    fixedStore.value = profile.store;
    form.storeId = profile.store.id;
    return;
  }
  if (profile.permissions.includes('store:view')) {
    // `/sub/stores` 返回数组（非分页对象）
    const res = await request.request<unknown, { data: { data: StoreBrief[] } }>({
      url: '/sub/stores',
      method: 'GET',
    });
    stores.value = res.data.data;
    if (stores.value.length === 1) form.storeId = stores.value[0].id;
  }
}

async function onVerify() {
  if (!form.code.trim()) {
    ElMessage.warning('请输入券码');
    return;
  }
  verifying.value = true;
  done.value = null;
  try {
    outcome.value = await redemptionApi.verify({
      code: form.code.trim().toUpperCase(),
      storeId: form.storeId,
      orderNo: form.orderNo.trim() || undefined,
      orderAmount: form.orderAmount,
    });
  } finally {
    verifying.value = false;
  }
}

async function onRedeem() {
  if (!form.orderNo.trim()) {
    ElMessage.warning('核销必须挂订单，请填写订单号');
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确认核销券 ${form.code.toUpperCase()}？抵扣 ${outcome.value?.data?.discountAmount ?? '-'} 元，核销后不可撤销。`,
      '核销确认',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  redeeming.value = true;
  try {
    const record = await redemptionApi.redeem({
      code: form.code.trim().toUpperCase(),
      storeId: form.storeId,
      orderNo: form.orderNo.trim(),
      orderAmount: form.orderAmount,
      channel: 'MANUAL',
    });
    done.value = record;
    outcome.value = null;
    ElMessage.success('核销成功');
  } finally {
    redeeming.value = false;
  }
}

function onReset() {
  form.code = '';
  form.orderNo = '';
  form.orderAmount = undefined;
  outcome.value = null;
  done.value = null;
}

onMounted(loadStoreOptions);
</script>

<style scoped>
.page__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.page__form {
  max-width: 760px;
}
.page__hint {
  margin-left: 12px;
  color: #94a3b8;
  font-size: 12px;
}
.page__desc,
.page__checks {
  margin-top: 14px;
}
.page__actions {
  margin-top: 16px;
}
</style>
