<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import NetworkBanner from '@/components/NetworkBanner.vue';
import {
  fetchIssueOptions,
  findUserIdByPhone,
  quickIssueCoupon,
  type IssueMerchantOption,
  type IssueOptions,
} from '@/services/merchant';
import { request } from '@/utils/request';
import { friendlyMessage } from '@/utils/errors';

type TemplateRow = {
  id: number;
  name: string;
  status?: string;
  faceValue?: number;
  thresholdAmount?: number;
  ownerType?: string;
  remainingStock?: number;
  totalStock?: number;
};

type IssuedRow = { id: number; code?: string; expireAt?: string };

const FACE_MAX = 500;

const loading = ref(true);
const submitting = ref(false);
const errorText = ref('');
const options = ref<IssueOptions | null>(null);
const templates = ref<TemplateRow[]>([]);
const templateId = ref(0);

const sheetOpen = ref(false);
const createOpen = ref(false);
const creating = ref(false);
const createForm = ref({
  benefitType: 'VOUCHER' as 'VOUCHER' | 'ITEM',
  itemName: '',
  faceValue: 15,
  thresholdAmount: 0,
  validDays: 7,
  totalStock: 100,
});

/** one=单家 multi=多选 all=全体 */
const scopeMode = ref<'one' | 'multi' | 'all'>('one');
const selectedIds = ref<number[]>([]);

const audience = ref<'USER' | 'MERCHANT_VISITORS'>('USER');
const targetType = ref<'phone' | 'userId'>('phone');
const phone = ref('');
const userId = ref('');
const quantity = ref(1);
const resultText = ref('');
const issued = ref<IssuedRow[]>([]);

const isMain = computed(() => options.value?.merchantType === 'MAIN');
const canQuickCreate = computed(() => !!options.value?.canQuickCreate);
const merchants = computed(() => options.value?.merchants || []);
const current = computed(() => templates.value.find((t) => t.id === templateId.value) || null);

const selectedLabel = computed(() => {
  if (scopeMode.value === 'all') return `全体联盟（${merchants.value.length} 家）`;
  if (!selectedIds.value.length) return '请选择商家';
  const names = merchants.value
    .filter((m) => selectedIds.value.includes(m.id))
    .map((m) => m.name);
  return names.join('、');
});

const createPreview = computed(() => {
  const f = createForm.value;
  const days = Number(f.validDays) || 7;
  const stock = Number(f.totalStock) || 0;
  if (f.benefitType === 'ITEM') {
    const item = f.itemName.trim() || '（请填写物品）';
    return `本次将发放 ${stock} 张「${item}」兑换券（有效期${days}天）`;
  }
  const face = Number(f.faceValue) || 0;
  const thr = Number(f.thresholdAmount) || 0;
  const thrText = thr > 0 ? `满${thr}减${face}` : `${face}元无门槛`;
  return `本次将发放 ${stock} 张 ${thrText}券（有效期${days}天）`;
});

const canSubmit = computed(() => {
  if (!templateId.value || submitting.value) return false;
  if (scopeMode.value !== 'all' && !selectedIds.value.length) return false;
  if (audience.value === 'MERCHANT_VISITORS') return true;
  if (targetType.value === 'phone') return /^1[3-9]\d{9}$/.test(phone.value.trim());
  return !!Number(userId.value);
});

onLoad((query) => {
  const preset = Number(query?.templateId || 0);
  if (preset) templateId.value = preset;
  load();
});

async function load() {
  loading.value = true;
  errorText.value = '';
  try {
    const opts = await fetchIssueOptions();
    options.value = opts;
    selectedIds.value = [opts.merchantId];
    scopeMode.value = 'one';

    const qs = opts.onlyMainCoupons
      ? 'page=1&pageSize=100&status=PUBLISHED&ownerType=MAIN_COUPON'
      : 'page=1&pageSize=100&status=PUBLISHED';
    const data = await request<{ list?: TemplateRow[] }>({
      url: `/coupon-templates?${qs}`,
      redirectOn401: false,
    });
    let rows = data?.list || [];
    if (opts.onlyMainCoupons) {
      rows = rows.filter((t) => !t.ownerType || t.ownerType === 'MAIN_COUPON');
    }
    // 附属快速建的附属券也要能看到：再拉一份自己的已上架券
    if (!opts.onlyMainCoupons || opts.canQuickCreate) {
      try {
        const own = await request<{ list?: TemplateRow[] }>({
          url: '/coupon-templates?page=1&pageSize=100&status=PUBLISHED',
          redirectOn401: false,
        });
        const map = new Map(rows.map((r) => [r.id, r]));
        for (const r of own?.list || []) map.set(r.id, r);
        rows = [...map.values()];
      } catch {
        /* ignore */
      }
    }
    templates.value = rows;
    if (!templateId.value && rows[0]) templateId.value = rows[0].id;
    if (templateId.value && !rows.some((t) => t.id === templateId.value)) {
      templateId.value = rows[0]?.id || 0;
    }
  } catch (error) {
    errorText.value = friendlyMessage(error, '发券选项加载失败');
    templates.value = [];
  } finally {
    loading.value = false;
  }
}

function openTemplateSheet() {
  sheetOpen.value = true;
}

function selectTemplate(row: TemplateRow) {
  templateId.value = row.id;
  sheetOpen.value = false;
}

function openCreateDrawer() {
  if (!canQuickCreate.value) {
    uni.showToast({ title: '暂无建券权限', icon: 'none' });
    return;
  }
  sheetOpen.value = false;
  createForm.value = {
    benefitType: 'VOUCHER',
    itemName: '',
    faceValue: 15,
    thresholdAmount: 0,
    validDays: 7,
    totalStock: 100,
  };
  createOpen.value = true;
}

function setBenefitType(kind: 'VOUCHER' | 'ITEM') {
  createForm.value.benefitType = kind;
  if (kind === 'ITEM' && !createForm.value.itemName) {
    createForm.value.faceValue = 0;
    createForm.value.thresholdAmount = 0;
  }
  if (kind === 'VOUCHER' && !(Number(createForm.value.faceValue) > 0)) {
    createForm.value.faceValue = 15;
  }
}

async function onQuickCreate() {
  const f = createForm.value;
  const days = Number(f.validDays);
  const stock = Number(f.totalStock);
  const itemName = f.itemName.trim();
  const face = Number(f.faceValue) || 0;
  const thr = Number(f.thresholdAmount) || 0;

  if (f.benefitType === 'ITEM') {
    if (!itemName) {
      uni.showToast({ title: '请填写兑换物品', icon: 'none' });
      return;
    }
    if (face < 0 || face > FACE_MAX) {
      uni.showToast({ title: `参考价值需在 0–${FACE_MAX} 元`, icon: 'none' });
      return;
    }
  } else {
    if (!(face > 0) || face > FACE_MAX) {
      uni.showToast({ title: `面值需在 0.01–${FACE_MAX} 元`, icon: 'none' });
      return;
    }
    if (thr < 0) {
      uni.showToast({ title: '门槛不能为负', icon: 'none' });
      return;
    }
  }
  if (!(days >= 1)) {
    uni.showToast({ title: '有效期至少 1 天', icon: 'none' });
    return;
  }
  if (!(stock >= 1 && stock <= 5000)) {
    uni.showToast({ title: '发放数量 1–5000', icon: 'none' });
    return;
  }

  creating.value = true;
  try {
    const scope =
      scopeMode.value === 'all'
        ? { allMerchants: true as const }
        : { targetMerchantIds: [...selectedIds.value], allMerchants: false as const };

    const payload: Parameters<typeof quickIssueCoupon>[0] = {
      name: f.benefitType === 'ITEM' ? `兑换：${itemName}` : '自定义发放',
      benefitType: f.benefitType,
      validDays: days,
      totalStock: stock,
      quantity: Math.min(50, Math.max(1, Number(quantity.value) || 1)),
      ...scope,
    };
    if (f.benefitType === 'ITEM') {
      payload.itemName = itemName;
      payload.faceValue = face;
      payload.thresholdAmount = 0;
    } else {
      payload.faceValue = face;
      payload.thresholdAmount = thr;
    }

    // 有明确会员则发个人；否则按所选商家到店会员发放（与「确认生成并发券」一致）
    if (audience.value === 'USER' && targetType.value === 'phone' && /^1[3-9]\d{9}$/.test(phone.value.trim())) {
      const uid = await findUserIdByPhone(phone.value.trim()).catch(() => null);
      payload.audience = 'USER';
      if (uid) payload.userId = uid;
      else payload.phone = phone.value.trim();
    } else if (audience.value === 'USER' && targetType.value === 'userId' && Number(userId.value)) {
      payload.audience = 'USER';
      payload.userId = Number(userId.value);
    } else {
      payload.audience = 'MERCHANT_VISITORS';
      if (!payload.targetMerchantIds?.length && !payload.allMerchants) {
        payload.targetMerchantIds = [options.value!.merchantId];
      }
    }

    const res = await quickIssueCoupon(payload);
    createOpen.value = false;
    uni.showToast({ title: res.issued ? '生成并发放成功' : '券已生成', icon: 'success' });
    resultText.value = res.message + (res.issueError ? `（${res.issueError}）` : '');
    issued.value = [];
    await load();
    if (res.templateId) templateId.value = res.templateId;
  } catch (error) {
    uni.showToast({ title: friendlyMessage(error, '建券失败'), icon: 'none' });
  } finally {
    creating.value = false;
  }
}

function setScope(mode: 'one' | 'multi' | 'all') {
  if (!isMain.value && mode !== 'one') {
    uni.showToast({ title: '附属商家只能发本店', icon: 'none' });
    return;
  }
  scopeMode.value = mode;
  if (mode === 'all') {
    selectedIds.value = merchants.value.map((m) => m.id);
  } else if (mode === 'one' && selectedIds.value.length > 1) {
    selectedIds.value = [selectedIds.value[0] || options.value!.merchantId];
  }
}

function toggleMerchant(row: IssueMerchantOption) {
  if (!isMain.value) return;
  if (scopeMode.value === 'all') {
    scopeMode.value = 'multi';
  }
  if (scopeMode.value === 'one') {
    selectedIds.value = [row.id];
    return;
  }
  const set = new Set(selectedIds.value);
  if (set.has(row.id)) {
    if (set.size <= 1) return;
    set.delete(row.id);
  } else {
    set.add(row.id);
  }
  selectedIds.value = [...set];
}

function setAudience(value: 'USER' | 'MERCHANT_VISITORS') {
  audience.value = value;
}

function setTarget(type: 'phone' | 'userId') {
  targetType.value = type;
}

function buildScopePayload() {
  if (scopeMode.value === 'all') {
    return { allMerchants: true as const };
  }
  return { targetMerchantIds: [...selectedIds.value], allMerchants: false as const };
}

async function onIssue() {
  if (!canSubmit.value || !templateId.value) return;
  submitting.value = true;
  resultText.value = '';
  issued.value = [];
  try {
    const scope = buildScopePayload();
    const qty = Math.min(50, Math.max(1, Number(quantity.value) || 1));
    let payload: Record<string, unknown> = {
      templateId: templateId.value,
      quantity: qty,
      audience: audience.value,
      ...scope,
    };

    if (audience.value === 'USER') {
      if (targetType.value === 'phone') {
        const uid = await findUserIdByPhone(phone.value.trim()).catch(() => null);
        payload = uid
          ? { ...payload, userId: uid }
          : { ...payload, phone: phone.value.trim() };
      } else {
        payload = { ...payload, userId: Number(userId.value) };
      }
    }

    if (isMain.value && scopeMode.value === 'one' && selectedIds.value[0]) {
      payload = { ...payload, merchantId: selectedIds.value[0] };
    }

    const res = await request<{
      quantity?: number;
      expireAt?: string;
      issued?: IssuedRow[];
      mode?: string;
      userCount?: number;
      failCount?: number;
      issuedQuantity?: number;
      targetMerchantIds?: number[];
    }>({
      url: '/coupon-instances/issue',
      method: 'POST',
      data: payload,
      redirectOn401: false,
    });

    if (res.mode === 'MERCHANT_VISITORS') {
      resultText.value = `已向 ${res.userCount} 位到店会员发放，共 ${res.issuedQuantity} 张${
        res.failCount ? `（跳过 ${res.failCount}）` : ''
      }`;
      issued.value = [];
    } else {
      issued.value = res.issued || [];
      resultText.value = `已发放 ${res.quantity} 张${res.expireAt ? `，有效期至 ${res.expireAt}` : ''}`;
    }
    uni.showToast({ title: '发放成功', icon: 'success' });
    await load();
  } catch (error) {
    uni.showToast({ title: friendlyMessage(error, '发放失败'), icon: 'none' });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <view class="page">
    <network-banner />
    <view class="hero">
      <text class="hero__t">代金券发放</text>
      <text class="hero__d">
        {{
          isMain
            ? '可选某家 / 多家 / 全体联盟商家 · 支持立即新建券'
            : canQuickCreate
              ? '可发放授权主体券，或快速新建本店附属券'
              : '附属商家仅可发放已授权的主体商家代金券'
        }}
      </text>
    </view>

    <view v-if="loading" class="skel" />
    <view v-else-if="errorText" class="fail">{{ errorText }}</view>
    <view v-else class="card">
      <text class="label">券模板{{ options?.onlyMainCoupons ? '（含授权主体券）' : '' }}</text>
      <view class="picker" @tap="openTemplateSheet">
        <text v-if="current">{{ current.name }} · 余 {{ current.remainingStock ?? '—' }}</text>
        <text v-else class="ph">选择已上架券模板 / 立即新建</text>
        <text class="arrow">›</text>
      </view>

      <text class="label">发放商家</text>
      <view class="tabs">
        <view class="tab" :class="{ on: scopeMode === 'one' }" @tap="setScope('one')">某家</view>
        <view class="tab" :class="{ on: scopeMode === 'multi', dim: !isMain }" @tap="setScope('multi')">多选</view>
        <view class="tab" :class="{ on: scopeMode === 'all', dim: !isMain }" @tap="setScope('all')">全体</view>
      </view>
      <text class="hint">{{ selectedLabel }}</text>
      <view class="merchant-list">
        <view
          v-for="m in merchants"
          :key="m.id"
          class="m-row"
          :class="{ on: scopeMode === 'all' || selectedIds.includes(m.id) }"
          @tap="toggleMerchant(m)"
        >
          <view class="check">{{ scopeMode === 'all' || selectedIds.includes(m.id) ? '✓' : '' }}</view>
          <view class="m-main">
            <text class="m-name">{{ m.name }}</text>
            <text class="m-role">{{ m.role === 'MAIN' ? '主体' : '附属' }}</text>
          </view>
        </view>
      </view>

      <text class="label">发放对象</text>
      <view class="tabs">
        <view class="tab" :class="{ on: audience === 'USER' }" @tap="setAudience('USER')">指定会员</view>
        <view
          class="tab"
          :class="{ on: audience === 'MERCHANT_VISITORS' }"
          @tap="setAudience('MERCHANT_VISITORS')"
        >所选商家到店会员</view>
      </view>

      <template v-if="audience === 'USER'">
        <view class="tabs sm">
          <view class="tab" :class="{ on: targetType === 'phone' }" @tap="setTarget('phone')">手机号</view>
          <view class="tab" :class="{ on: targetType === 'userId' }" @tap="setTarget('userId')">用户 id</view>
        </view>
        <input
          v-if="targetType === 'phone'"
          v-model="phone"
          class="input"
          type="number"
          maxlength="11"
          placeholder="会员手机号"
        />
        <input
          v-else
          v-model="userId"
          class="input"
          type="number"
          placeholder="用户 id"
        />
      </template>
      <text v-else class="hint">将向所选商家近到店会员各发 {{ quantity }} 张（最多 100 人）</text>

      <text class="label">每人数量（1–50）</text>
      <input v-model.number="quantity" class="input" type="number" />

      <button class="btn" :disabled="!canSubmit" :loading="submitting" @tap="onIssue">
        {{ submitting ? '发放中…' : '确认发放' }}
      </button>
    </view>

    <view v-if="resultText" class="card result">
      <text class="ok">{{ resultText }}</text>
      <view v-for="row in issued" :key="row.id" class="code-row">
        <text class="code">{{ row.code || `#${row.id}` }}</text>
        <text class="exp">{{ row.expireAt || '' }}</text>
      </view>
    </view>

    <!-- 模板选择底部面板 -->
    <view v-if="sheetOpen" class="mask" @tap="sheetOpen = false">
      <view class="sheet" @tap.stop>
        <view class="sheet__hd">
          <text class="sheet__t">选择券模板</text>
          <text class="sheet__x" @tap="sheetOpen = false">关闭</text>
        </view>
        <view
          v-if="canQuickCreate"
          class="create-entry"
          @tap="openCreateDrawer"
        >
          <text class="create-entry__plus">+</text>
          <view class="create-entry__main">
            <text class="create-entry__t">立即新建一张券</text>
            <text class="create-entry__d">金额减免或兑换物品，生成后可立刻发放</text>
          </view>
        </view>
        <scroll-view scroll-y class="sheet__list">
          <view
            v-for="t in templates"
            :key="t.id"
            class="tpl-row"
            :class="{ on: t.id === templateId }"
            @tap="selectTemplate(t)"
          >
            <view class="tpl-main">
              <text class="tpl-name">{{ t.name }}</text>
              <text class="tpl-meta">
                ¥{{ t.faceValue ?? 0 }}
                <text v-if="(t.thresholdAmount || 0) > 0"> · 满{{ t.thresholdAmount }}</text>
                <text v-else> · 无门槛</text>
                · 余 {{ t.remainingStock ?? '—' }}
              </text>
            </view>
            <text v-if="t.id === templateId" class="tpl-check">✓</text>
          </view>
          <view v-if="!templates.length" class="sheet__empty">暂无已上架模板，请先新建</view>
        </scroll-view>
      </view>
    </view>

    <!-- 新建券抽屉 -->
    <view v-if="createOpen" class="mask" @tap="createOpen = false">
      <view class="sheet create-sheet" @tap.stop>
        <view class="sheet__hd">
          <text class="sheet__t">立即新建一张券</text>
          <text class="sheet__x" @tap="createOpen = false">关闭</text>
        </view>
        <view class="form">
          <text class="label">券类型</text>
          <view class="tabs sm">
            <view
              class="tab"
              :class="{ on: createForm.benefitType === 'VOUCHER' }"
              @tap="setBenefitType('VOUCHER')"
            >金额减免</view>
            <view
              class="tab"
              :class="{ on: createForm.benefitType === 'ITEM' }"
              @tap="setBenefitType('ITEM')"
            >兑换物品</view>
          </view>

          <template v-if="createForm.benefitType === 'ITEM'">
            <text class="label">兑换物品（商家填写）</text>
            <input
              v-model="createForm.itemName"
              class="input"
              maxlength="50"
              placeholder="例如：拿铁一杯 / 洗车一次 / 甜品一份"
            />
            <text class="label">参考价值（元，选填，最大 {{ FACE_MAX }}）</text>
            <input v-model.number="createForm.faceValue" class="input" type="digit" placeholder="0" />
          </template>
          <template v-else>
            <text class="label">面值（元，最大 {{ FACE_MAX }}）</text>
            <input v-model.number="createForm.faceValue" class="input" type="digit" />
            <text class="label">门槛（元，0=无门槛）</text>
            <input v-model.number="createForm.thresholdAmount" class="input" type="digit" />
          </template>

          <text class="label">有效期天数</text>
          <input v-model.number="createForm.validDays" class="input" type="number" />
          <text class="label">发放数量（库存）</text>
          <input v-model.number="createForm.totalStock" class="input" type="number" />
          <view class="preview">{{ createPreview }}</view>
          <button class="btn" :loading="creating" @tap="onQuickCreate">
            {{ creating ? '生成中…' : '确认生成并发券' }}
          </button>
          <text class="hint center">将按上方所选商家立即发放；若已填指定会员则优先发该会员</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page { min-height: 100vh; padding-bottom: 80rpx; box-sizing: border-box; background: #f3f7f8; }
.hero {
  padding: 36rpx 32rpx 48rpx;
  background: linear-gradient(135deg, #09303a 0%, #0b2440 100%);
  border-radius: 0 0 40rpx 40rpx;
}
.hero__t { display: block; font-size: 40rpx; font-weight: 800; color: #fff; }
.hero__d { display: block; margin-top: 10rpx; font-size: 24rpx; color: rgba(255,255,255,.85); line-height: 1.45; }
.card {
  margin: -20rpx 32rpx 20rpx; padding: 28rpx; background: #fff; border-radius: 32rpx;
  box-shadow: 0 12rpx 36rpx rgba(10, 60, 58, 0.06); position: relative; z-index: 1;
}
.label { display: block; margin: 8rpx 0 12rpx; font-size: 24rpx; color: #8a9aa3; font-weight: 600; }
.picker {
  display: flex; align-items: center; justify-content: space-between;
  padding: 22rpx 24rpx; border-radius: 20rpx; background: #f3f7f8; margin-bottom: 16rpx;
  font-size: 28rpx; font-weight: 700; color: #0e1f26;
}
.ph { color: #8a9aa3; font-weight: 500; }
.arrow { color: #8a9aa3; font-size: 36rpx; }
.tabs { display: flex; gap: 12rpx; margin-bottom: 12rpx; flex-wrap: wrap; }
.tabs.sm .tab { font-size: 24rpx; padding: 12rpx 0; }
.tab {
  flex: 1; min-width: 28%; text-align: center; padding: 16rpx 0; border-radius: 999rpx;
  background: #f1f5f7; color: #556670; font-weight: 700; font-size: 26rpx;
}
.tab.on { background: linear-gradient(135deg, #00d6b2, #19a7f8); color: #fff; }
.tab.dim { opacity: 0.45; }
.hint { display: block; margin: 0 0 12rpx; font-size: 22rpx; color: #8a9aa3; line-height: 1.4; }
.hint.center { text-align: center; margin-top: 12rpx; }
.merchant-list { margin-bottom: 12rpx; }
.m-row {
  display: flex; align-items: center; gap: 16rpx; padding: 18rpx 0;
  border-top: 1px solid #eaf0f2;
}
.m-row:first-child { border-top: none; }
.m-row.on .check { background: #00b8a0; color: #fff; border-color: #00b8a0; }
.check {
  width: 44rpx; height: 44rpx; border-radius: 12rpx; border: 2rpx solid #c5d0d6;
  display: flex; align-items: center; justify-content: center; font-size: 22rpx; font-weight: 800;
  color: transparent; flex-shrink: 0;
}
.m-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12rpx; }
.m-name { font-size: 28rpx; font-weight: 700; color: #0e1f26; }
.m-role {
  padding: 2rpx 10rpx; border-radius: 999rpx; background: #f1f5f7; color: #556670;
  font-size: 20rpx; font-weight: 600;
}
.input {
  height: 84rpx; padding: 0 24rpx; border-radius: 20rpx; background: #f3f7f8;
  margin-bottom: 16rpx; font-size: 28rpx;
}
.btn {
  margin-top: 12rpx; background: linear-gradient(135deg, #00d6b2, #19a7f8);
  color: #fff; border-radius: 999rpx; font-weight: 800; border: none;
}
.btn[disabled] { opacity: 0.45; }
.result .ok { display: block; font-size: 28rpx; font-weight: 800; color: #00766a; margin-bottom: 12rpx; }
.code-row {
  display: flex; justify-content: space-between; gap: 12rpx;
  padding: 14rpx 0; border-top: 1px solid #eaf0f2; font-size: 24rpx;
}
.code { font-weight: 700; color: #0e1f26; font-family: ui-monospace, monospace; }
.exp { color: #8a9aa3; }
.fail { margin: 32rpx; color: #c22a2e; font-weight: 700; }
.skel { margin: 32rpx; height: 360rpx; border-radius: 32rpx; background: #e2eaee; }

.mask {
  position: fixed; inset: 0; background: rgba(8, 24, 32, 0.45); z-index: 100;
  display: flex; align-items: flex-end;
}
.sheet {
  width: 100%; max-height: 78vh; background: #fff; border-radius: 32rpx 32rpx 0 0;
  padding: 24rpx 28rpx calc(28rpx + env(safe-area-inset-bottom)); box-sizing: border-box;
}
.sheet__hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; }
.sheet__t { font-size: 32rpx; font-weight: 800; color: #0e1f26; }
.sheet__x { font-size: 26rpx; color: #8a9aa3; padding: 8rpx 12rpx; }
.sheet__list { max-height: 52vh; }
.sheet__empty { padding: 48rpx 0; text-align: center; color: #8a9aa3; font-size: 26rpx; }

.create-entry {
  display: flex; align-items: center; gap: 20rpx; padding: 22rpx 20rpx; margin-bottom: 16rpx;
  border-radius: 24rpx; background: linear-gradient(135deg, #e8fbf7, #e8f4ff);
  border: 2rpx solid rgba(0, 184, 160, 0.35);
}
.create-entry__plus {
  width: 64rpx; height: 64rpx; border-radius: 20rpx; background: #00b8a0; color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 40rpx; font-weight: 800;
  flex-shrink: 0;
}
.create-entry__main { flex: 1; min-width: 0; }
.create-entry__t { display: block; font-size: 30rpx; font-weight: 800; color: #00766a; }
.create-entry__d { display: block; margin-top: 4rpx; font-size: 22rpx; color: #556670; }

.tpl-row {
  display: flex; align-items: center; gap: 12rpx; padding: 22rpx 8rpx;
  border-top: 1px solid #eaf0f2;
}
.tpl-row.on { background: #f3fbf9; }
.tpl-main { flex: 1; min-width: 0; }
.tpl-name { display: block; font-size: 28rpx; font-weight: 700; color: #0e1f26; }
.tpl-meta { display: block; margin-top: 4rpx; font-size: 22rpx; color: #8a9aa3; }
.tpl-check { color: #00b8a0; font-weight: 800; font-size: 32rpx; }

.create-sheet .form { padding-top: 8rpx; }
.preview {
  margin: 8rpx 0 20rpx; padding: 20rpx 22rpx; border-radius: 20rpx;
  background: #fff8e8; color: #9a6b00; font-size: 26rpx; font-weight: 700; line-height: 1.45;
}
</style>
