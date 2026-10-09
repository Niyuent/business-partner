<template>
  <el-form :model="form" label-width="120px" class="coupon-form">
    <el-divider content-position="left">基本信息</el-divider>

    <el-form-item label="券归属类型">
      <el-radio-group v-model="form.ownerType" :disabled="isEdit">
        <el-radio-button label="MAIN_COUPON">主体券</el-radio-button>
        <el-radio-button label="SUB_COUPON">附属商家券</el-radio-button>
      </el-radio-group>
      <div class="coupon-form__hint">
        主体券可被授权给附属商家发放；附属商家券只能由该商家自己使用。归属在创建后不可修改。
      </div>
    </el-form-item>

    <el-form-item v-if="form.ownerType === 'SUB_COUPON'" label="归属商家" required>
      <el-select v-model="form.ownerMerchantId" placeholder="选择附属商家" style="width: 260px" :disabled="isEdit">
        <el-option
          v-for="m in subMerchants"
          :key="m.id"
          :label="`${m.name}（${m.code}）`"
          :value="m.id"
        />
      </el-select>
    </el-form-item>

    <el-form-item label="券名称" required>
      <el-input v-model="form.name" maxlength="100" placeholder="如：T5 春日踏青券" style="width: 320px" />
    </el-form-item>
    <el-form-item label="副标题">
      <el-input v-model="form.subtitle" maxlength="100" placeholder="如：全平台通用代金券" style="width: 320px" />
    </el-form-item>

    <el-divider content-position="left">面额与库存</el-divider>

    <el-form-item label="面值（元）" required>
      <el-input-number v-model="form.faceValue" :min="0.01" :precision="2" :step="1" />
    </el-form-item>
    <el-form-item label="使用门槛（元）">
      <el-input-number v-model="form.thresholdAmount" :min="0" :precision="2" :step="10" />
      <span class="coupon-form__hint">0 表示无门槛</span>
    </el-form-item>
    <el-form-item label="兑换所需积分">
      <el-input-number v-model="form.pointsCost" :min="0" :step="1" />
    </el-form-item>
    <el-form-item label="采购结算价">
      <el-input-number v-model="form.purchasePrice" :min="0" :precision="2" :step="1" />
    </el-form-item>
    <el-form-item label="发行总量" required>
      <el-input-number v-model="form.totalStock" :min="1" :step="10" />
      <span v-if="isEdit" class="coupon-form__hint">
        已发放 {{ value?.issuedCount ?? 0 }} 张，下调后不得低于该数量
      </span>
    </el-form-item>

    <el-divider content-position="left">有效期</el-divider>

    <el-form-item label="有效期类型">
      <el-radio-group v-model="form.validType">
        <el-radio-button label="AFTER_RECEIVE_DAYS">领取后 N 天</el-radio-button>
        <el-radio-button label="FIXED">固定有效期</el-radio-button>
      </el-radio-group>
    </el-form-item>
    <el-form-item v-if="form.validType === 'FIXED'" label="有效期区间" required>
      <el-date-picker
        v-model="form.validRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
      />
    </el-form-item>
    <el-form-item v-else label="有效天数">
      <el-input-number v-model="form.validDays" :min="1" :max="3650" />
      <span class="coupon-form__hint">自用户获得该券当天起算</span>
    </el-form-item>

    <el-divider content-position="left">适用范围</el-divider>

    <el-form-item label="适用范围">
      <el-radio-group v-model="form.applyScope">
        <el-radio-button label="ALL_STORES">全部门店</el-radio-button>
        <el-radio-button label="SPECIFIED_STORES">指定门店</el-radio-button>
      </el-radio-group>
    </el-form-item>
    <el-form-item v-if="form.applyScope === 'SPECIFIED_STORES'" label="适用门店" required>
      <el-select
        v-model="form.storeIds"
        multiple
        filterable
        placeholder="选择门店（属于该券的归属商家）"
        style="width: 420px"
        :loading="storeLoading"
        @focus="loadStores"
      >
        <el-option v-for="s in stores" :key="s.id" :label="`${s.name}（${s.code}）`" :value="s.id" />
      </el-select>
    </el-form-item>

    <el-divider content-position="left">其他</el-divider>

    <el-form-item label="每人限领">
      <el-input-number v-model="form.perUserLimit" :min="1" :max="99" />
    </el-form-item>
    <el-form-item label="使用说明">
      <el-input v-model="form.description" type="textarea" :rows="2" maxlength="500" style="width: 420px" />
    </el-form-item>
    <el-form-item label="规则备注">
      <el-input v-model="form.rules" type="textarea" :rows="2" maxlength="500" style="width: 420px" />
    </el-form-item>

    <el-form-item>
      <el-button type="primary" :loading="submitting" @click="onSubmit">
        {{ isEdit ? '保存修改' : '创建（草稿）' }}
      </el-button>
      <el-button @click="$emit('cancel')">取消</el-button>
      <span v-if="!isEdit" class="coupon-form__hint">
        创建后为草稿状态，需上架后才能被发放 / 兑换
      </span>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { merchantApi } from '@/api/merchant';
import type {
  ApplyScope,
  CouponOwnerType,
  CouponTemplate,
  CreateCouponTemplatePayload,
  Merchant,
  ValidType,
} from '@/types/business';

const props = defineProps<{
  /** 编辑模式下传入原对象；新建为 undefined */
  value?: CouponTemplate | null;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  (e: 'submit', payload: CreateCouponTemplatePayload): void;
  (e: 'cancel'): void;
}>();

const isEdit = computed(() => !!props.value);

const form = reactive({
  ownerType: 'MAIN_COUPON' as CouponOwnerType,
  ownerMerchantId: undefined as number | undefined,
  name: '',
  subtitle: '',
  faceValue: 20,
  thresholdAmount: 100,
  pointsCost: 20,
  purchasePrice: 15,
  totalStock: 500,
  validType: 'AFTER_RECEIVE_DAYS' as ValidType,
  validRange: [] as string[],
  validDays: 30,
  applyScope: 'ALL_STORES' as ApplyScope,
  storeIds: [] as number[],
  perUserLimit: 1,
  description: '',
  rules: '',
});

/** 用原对象回填表单（编辑模式） */
function fillFrom(row: CouponTemplate) {
  form.ownerType = row.ownerType;
  form.ownerMerchantId = row.ownerMerchantId;
  form.name = row.name;
  form.subtitle = row.subtitle ?? '';
  form.faceValue = row.faceValue;
  form.thresholdAmount = row.thresholdAmount;
  form.pointsCost = row.pointsCost;
  form.purchasePrice = row.purchasePrice;
  form.totalStock = row.totalStock;
  form.validType = row.validType;
  form.validRange =
    row.validType === 'FIXED' && row.validStart && row.validEnd
      ? [row.validStart.slice(0, 10), row.validEnd.slice(0, 10)]
      : [];
  form.validDays = row.validDays || 30;
  form.applyScope = row.applyScope;
  form.storeIds = [...row.storeIds];
  form.perUserLimit = row.perUserLimit;
  form.description = row.description ?? '';
  form.rules = row.rules ?? '';
}

watch(
  () => props.value,
  (row) => {
    if (row) fillFrom(row);
  },
  { immediate: true },
);

// ---------------------------------------------------------------- 下拉数据

const subMerchants = ref<Merchant[]>([]);
const stores = ref<Array<{ id: number; name: string; code: string }>>([]);
const storeLoading = ref(false);

async function loadSubMerchants() {
  try {
    const res = await merchantApi.list({ type: 'SUB', pageSize: 200 });
    subMerchants.value = res.list;
  } catch {
    subMerchants.value = [];
  }
}
if (isEdit.value) loadSubMerchants();

/** 门店清单：主接口只有附属商家视角的 /sub/stores，这里按「本主体下所有附属商家的门店」拼 */
const storesLoaded = ref(false);
async function loadStores() {
  if (storesLoaded.value) return;
  storeLoading.value = true;
  try {
    const list = subMerchants.value.length ? subMerchants.value : (await merchantApi.list({ type: 'SUB', pageSize: 200 })).list;
    subMerchants.value = list;
    const all: Array<{ id: number; name: string; code: string }> = [];
    for (const m of list) {
      try {
        const detail = await merchantApi.detail(m.id);
        all.push(...(detail.stores ?? []).map((s: any) => ({ id: s.id, name: s.name, code: s.code })));
      } catch {
        /* 某个商家查不动就跳过，不阻塞整体 */
      }
    }
    stores.value = all;
    storesLoaded.value = true;
  } finally {
    storeLoading.value = false;
  }
}
if (isEdit.value && (form.applyScope === 'SPECIFIED_STORES' || form.storeIds.length)) loadStores();

// ---------------------------------------------------------------- 提交

function onSubmit() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写券名称');
    return;
  }
  if (form.ownerType === 'SUB_COUPON' && !form.ownerMerchantId) {
    ElMessage.warning('附属商家券必须选择归属商家');
    return;
  }
  if (form.validType === 'FIXED' && form.validRange.length !== 2) {
    ElMessage.warning('固定有效期必须选择开始与结束日期');
    return;
  }
  if (form.applyScope === 'SPECIFIED_STORES' && !form.storeIds.length) {
    ElMessage.warning('指定门店范围时必须选择至少 1 家门店');
    return;
  }

  const validStart = form.validType === 'FIXED' ? `${form.validRange[0]}T00:00:00.000Z` : undefined;
  const validEnd =
    form.validType === 'FIXED' ? `${form.validRange[1]}T23:59:59.000Z` : undefined;

  const payload: CreateCouponTemplatePayload = {
    ownerType: form.ownerType,
    ...(form.ownerType === 'SUB_COUPON' ? { ownerMerchantId: form.ownerMerchantId } : {}),
    name: form.name.trim(),
    subtitle: form.subtitle.trim() || undefined,
    faceValue: form.faceValue,
    thresholdAmount: form.thresholdAmount,
    pointsCost: form.pointsCost,
    purchasePrice: form.purchasePrice,
    totalStock: form.totalStock,
    validType: form.validType,
    ...(validStart ? { validStart } : {}),
    ...(validEnd ? { validEnd } : {}),
    ...(form.validType === 'AFTER_RECEIVE_DAYS' ? { validDays: form.validDays } : {}),
    applyScope: form.applyScope,
    ...(form.applyScope === 'SPECIFIED_STORES' ? { storeIds: form.storeIds } : {}),
    perUserLimit: form.perUserLimit,
    description: form.description.trim() || undefined,
    rules: form.rules.trim() || undefined,
  };

  emit('submit', payload);
}

watch(
  () => form.ownerType,
  (v) => {
    if (v === 'SUB_COUPON' && !subMerchants.value.length) loadSubMerchants();
  },
);
</script>

<style scoped>
.coupon-form__hint {
  margin-left: 12px;
  color: #94a3b8;
  font-size: 12px;
}
</style>
