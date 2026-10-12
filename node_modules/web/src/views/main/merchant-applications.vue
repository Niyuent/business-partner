<template>
  <div class="page">
    <el-card shadow="never">
      <el-form :inline="true" class="page__filter">
        <el-form-item label="状态">
          <el-select v-model="query.status" style="width: 140px" @change="onSearch">
            <el-option label="待审核" value="PENDING" />
            <el-option label="已通过" value="APPROVED" />
            <el-option label="已驳回" value="REJECTED" />
            <el-option label="已暂停" value="SUSPENDED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="onSearch">查询</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="list" border stripe>
        <el-table-column prop="id" label="申请 id" width="90" />
        <el-table-column prop="code" label="商家编码" width="130" />
        <el-table-column prop="name" label="商家名称" min-width="160" />
        <el-table-column prop="contactName" label="联系人" width="110" />
        <el-table-column prop="contactPhone" label="联系电话" width="130" />
        <el-table-column prop="licenseNo" label="营业执照号" min-width="180" />
        <el-table-column label="提交时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
            <!-- 按钮级权限：没有 merchant:audit 的角色看不到这两个按钮 -->
            <el-button
              v-permission="'merchant:audit'"
              link
              type="success"
              :disabled="row.status !== 'PENDING'"
              @click="onApprove(row)"
            >
              通过
            </el-button>
            <el-button
              v-permission="'merchant:audit'"
              link
              type="danger"
              :disabled="row.status !== 'PENDING'"
              @click="onReject(row)"
            >
              驳回
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="该状态下暂无入驻申请" />
        </template>
      </el-table>

      <el-pagination
        class="page__pager"
        background
        layout="total, sizes, prev, pager, next"
        :total="total"
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :page-sizes="[10, 20, 50]"
        @size-change="load"
        @current-change="load"
      />
    </el-card>

    <!-- 申请详情 -->
    <el-dialog v-model="detailVisible" title="入驻申请详情" width="640px">
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="商家编码">{{ current?.code }}</el-descriptions-item>
        <el-descriptions-item label="商家名称">{{ current?.name }}</el-descriptions-item>
        <el-descriptions-item label="联系人">{{ current?.contactName }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ current?.contactPhone }}</el-descriptions-item>
        <el-descriptions-item label="营业执照号" :span="2">{{ current?.licenseNo }}</el-descriptions-item>
        <el-descriptions-item label="所在地区" :span="2">
          {{ [current?.province, current?.city, current?.district].filter(Boolean).join(' ') || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="详细地址" :span="2">{{ current?.address || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="current ? statusTagType(current.status) : 'info'" size="small">
            {{ current ? statusLabel(current.status) : '-' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ formatDateTime(current?.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="审核备注" :span="2">{{ current?.auditRemark || '-' }}</el-descriptions-item>
        <el-descriptions-item label="营业执照" :span="2">
          <div v-if="licenseImages.length" class="page__licenses">
            <el-image
              v-for="src in licenseImages"
              :key="src"
              :src="src"
              :preview-src-list="licenseImages"
              fit="cover"
              class="page__license"
            />
          </div>
          <span v-else>-</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { merchantApi } from '@/api/merchant';
import type { MerchantApplication, MerchantStatus } from '@/types/business';
import { formatDateTime, statusLabel, statusTagType } from '@/utils/dict';

const list = ref<MerchantApplication[]>([]);
const total = ref(0);
const loading = ref(false);
const detailVisible = ref(false);
const current = ref<MerchantApplication | null>(null);

const query = reactive({ page: 1, pageSize: 10, status: 'PENDING' as MerchantStatus });

const licenseImages = computed(() => (current.value?.licenseImages ?? []).filter(Boolean));

async function load() {
  loading.value = true;
  try {
    const res = await merchantApi.applications({ ...query });
    list.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  query.page = 1;
  load();
}

function openDetail(row: MerchantApplication) {
  current.value = row;
  detailVisible.value = true;
}

/**
 * 审核通过：一次 prompt 收备注（可留空），成功后展示**一次性初始口令**。
 * 后端把「改状态 + 建账号」放在同一事务里，并发/重复提交只会拿到 409 MERCHANT_NOT_PENDING。
 */
async function onApprove(row: MerchantApplication) {
  const prompt = await ElMessageBox.prompt(
    `确认通过「${row.name}」的入驻申请？通过后自动创建商家管理员账号。`,
    '审核通过',
    {
      inputPlaceholder: '审核备注（可选）',
      inputValue: '',
      confirmButtonText: '确认通过',
      cancelButtonText: '取消',
      type: 'warning',
    },
  ).catch(() => null);

  if (!prompt) return;
  const auditRemark = (prompt.value || '').trim();

  try {
    const res = await merchantApi.approve(row.id, { auditRemark: auditRemark || undefined });
    ElMessage.success('审核已通过');
    if (res.account) {
      // 初始口令只在本次响应里出现一次，必须让用户当场记下来
      await ElMessageBox.alert(
        `<div style="line-height:2">
           账号：<b>${res.account.username}</b><br/>
           初始口令：<b style="color:#e6a23c">${res.account.password}</b><br/>
           <span style="color:#909399;font-size:12px">口令仅展示这一次，请立即保存并通知商家；该账号首次登录需修改密码。</span>
         </div>`,
        '商家管理员账号已创建',
        { dangerouslyUseHTMLString: true, confirmButtonText: '我已保存' },
      );
    }
    load();
  } catch (e) {
    const msg = (e as Error).message || '';
    if (msg.includes('MERCHANT_NOT_PENDING') || msg.includes('不可重复审核')) {
      ElMessage.warning('该申请已被其他人审核过（409），请刷新列表');
      load();
      return;
    }
    throw e;
  }
}

/** 驳回：auditRemark 必填（后端强校验，长度 2-255） */
async function onReject(row: MerchantApplication) {
  const prompt = await ElMessageBox.prompt('请填写驳回原因（必填，将展示给商家）', '驳回申请', {
    inputPlaceholder: '如：营业执照模糊，请重新上传',
    inputPattern: /\S{2,}/,
    inputErrorMessage: '驳回原因至少 2 个字符',
    inputType: 'textarea',
  }).catch(() => null);

  if (!prompt) return;

  try {
    await merchantApi.reject(row.id, { auditRemark: (prompt.value || '').trim() });
    ElMessage.success('已驳回');
    load();
  } catch (e) {
    const msg = (e as Error).message || '';
    if (msg.includes('MERCHANT_NOT_PENDING') || msg.includes('不可重复审核')) {
      ElMessage.warning('该申请已被其他人处理过（409），请刷新列表');
      load();
      return;
    }
    throw e;
  }
}

onMounted(load);
</script>

<style scoped>
.page__filter {
  margin-bottom: 4px;
}
.page__pager {
  margin-top: 16px;
  justify-content: flex-end;
}
.page__licenses {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.page__license {
  width: 90px;
  height: 90px;
  border-radius: 6px;
}
</style>
