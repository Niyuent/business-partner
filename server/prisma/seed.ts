/**
 * 演示数据（Seed）
 *
 * 目标：跑通完整闭环 —— 登录 → 授权 → 发券 → 兑换 → 核销 → 报表
 * 数据要求详见 docs/04-业务规则与验收用例.md 第四节
 *
 * 运行：npm run prisma:seed
 */
import {
  AdminUserType,
  ApplyScope,
  AuthStatus,
  AuthType,
  ChangeStatus,
  CouponCodeStatus,
  CouponInstanceStatus,
  CouponOwnerType,
  CouponSource,
  CouponTemplateStatus,
  CouponType,
  ExpireMode,
  MerchantStatus,
  MerchantType,
  NotificationType,
  NotifyLevel,
  OrderSource,
  OrderStatus,
  OrderType,
  PointTxnType,
  PrismaClient,
  ReadStatus,
  RoleScope,
  ReceiverType,
  RedemptionChannel,
  RedemptionStatus,
  SettleStatus,
  StoreStatus,
  TemplateScope,
  ValidType,
} from '@prisma/client';
import { hashSync } from 'bcryptjs';
// S2.2：券码生成复用生产算法，保证演示券码与线上同源（含校验位）
import { generateCouponCodes } from '../src/modules/coupon/coupon-code.util';

const prisma = new PrismaClient();

/**
 * 演示账号统一口令。
 * 必须满足 `/auth/password` 的新密码策略（≥8 位），否则改密接口无法把它改回去。
 */
const PASSWORD = 'Test@123456';

/**
 * 核心实体的**固定主键**。
 *
 * 目的：seed 可重复执行且主键稳定，验收用例可以硬编码 id，
 * 不必每次重跑 seed 后重新推导（曾出现过 sub01 的 merchantId 从 2 变成 5，
 * 导致越权用例把「id 过期」误判成「越权成功」）。
 *
 * ⚠️ 改动这里的任何数字，都必须同步更新 `docs/06-验收清单.md` 的「稳定 ID 对照表」。
 */
const ID = {
  // 商家：1 = 主体，2/3 = 附属（已通过），4 = 待审核的入驻申请
  MERCHANT_MAIN: 1,
  MERCHANT_SUB1: 2,
  MERCHANT_SUB2: 3,
  MERCHANT_SUB3_PENDING: 4,
  // 门店：101/102 属 sub1，201 属 sub2
  STORE_101: 101,
  STORE_102: 102,
  STORE_201: 201,
  // 角色
  ROLE_PLATFORM_ADMIN: 1,
  ROLE_MAIN_ADMIN: 2,
  ROLE_SUB_ADMIN: 3,
  ROLE_SUB_ADMIN_BASIC: 4,
  ROLE_STORE_CLERK: 5,
  // 后台账号
  ADMIN: 1,
  ADMIN_SUB01: 2,
  ADMIN_SUB02: 3,
  ADMIN_CLERK01: 4,
  // S3.2 补：真正的**平台管理员**账号（userType=PLATFORM + PLATFORM_ADMIN 角色）。
  // 之前只有 MAIN_ADMIN 角色的 admin（它本质是"主体商家管理员"，merchantId=1），
  // 导致所有 `userType === 'PLATFORM'` 的分支在种子数据里根本走不到。
  ADMIN_PLATFORM: 5,
  // C 端用户
  USER_ZHANGSAN: 1001,
  USER_LISI: 1002,
  /**
   * 券模板：**主体券 1001 起，附属商家券 2001 起**。
   * 与上面同目的 —— 用例/文档示例可以直接写死 1001/1002，不必每次 seed 后重新推导。
   */
  TEMPLATE_MAIN_1: 1001,
  TEMPLATE_MAIN_2: 1002,
  TEMPLATE_MAIN_3: 1003,
  TEMPLATE_SUB_4: 2001,
  // S2.1：专门留一张 DRAFT 模板，供「编辑 / 上架」用例直接写死（1004）
  TEMPLATE_MAIN_5_DRAFT: 1004,
} as const;

/**
 * 券码生成（S2.2）：直接复用生产算法 `src/modules/coupon/coupon-code.util`
 * —— 12 位（11 位 crypto 随机位 + 1 位校验位），字符集去掉 0/O/1/I/L。
 * seed 里不再自己拼码，避免「演示数据用一套算法、线上用另一套」。
 */
function makeCodes(count: number) {
  return generateCouponCodes(count);
}

function addMonths(base: Date, months: number) {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function main() {
  console.log('→ 清理旧数据 ...');
  // 注意顺序：先删依赖表
  // 外键引用 coupon_templates 的表必须先清：
  //   redemption_records / coupon_codes / coupon_instances / coupon_template_stores
  //   / merchant_authorization_templates / purchase_records
  await prisma.redemptionRecord.deleteMany();
  await prisma.order.deleteMany();
  // S3.2：兑换记录引用 users / coupon_templates / coupon_instances，必须在这些表之前清
  await prisma.exchangeRecord.deleteMany();
  await prisma.couponCode.deleteMany();
  await prisma.couponCodeBatch.deleteMany(); // S2.2：券码批次（必须晚于 coupon_codes）
  await prisma.couponInstance.deleteMany();
  await prisma.pointTransaction.deleteMany();
  await prisma.pointAccount.deleteMany();
  await prisma.pointRule.deleteMany();
  await prisma.couponTemplateStore.deleteMany();
  await prisma.purchaseRecord.deleteMany();
  await prisma.settlementReport.deleteMany();
  await prisma.merchantAuthorizationTemplate.deleteMany();
  await prisma.merchantAuthorization.deleteMany();
  await prisma.couponTemplate.deleteMany();
  await prisma.storeChangeRequest.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.adminUserRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.store.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.user.deleteMany();

  const now = new Date();

  // ---------------------------------------------------------------- 商家
  console.log('→ 创建商家 ...');
  const main = await prisma.merchant.create({
    data: {
      id: ID.MERCHANT_MAIN,
      type: MerchantType.MAIN,
      name: '星链商盟（主体）',
      code: 'MAIN-01',
      contactName: '王主体',
      contactPhone: '13900000001',
      licenseNo: '91310000MA1FL0001X',
      province: '上海市',
      city: '上海市',
      district: '浦东新区',
      address: '世纪大道 100 号 30 层',
      settleContact: '财务-李 13800001111（线下结算）',
      status: MerchantStatus.APPROVED,
      auditedAt: now,
    },
  });

  const sub1 = await prisma.merchant.create({
    data: {
      id: ID.MERCHANT_SUB1,
      parentId: main.id,
      type: MerchantType.SUB,
      name: '城南旗舰店',
      code: 'SUB-01',
      contactName: '陈城南',
      contactPhone: '13900000002',
      licenseNo: '91310000MA1FL0002X',
      province: '上海市',
      city: '上海市',
      district: '徐汇区',
      address: '中山南路 200 号',
      status: MerchantStatus.APPROVED,
      auditorId: null,
      auditedAt: now,
    },
  });

  const sub2 = await prisma.merchant.create({
    data: {
      id: ID.MERCHANT_SUB2,
      parentId: main.id,
      type: MerchantType.SUB,
      name: '城西社区店',
      code: 'SUB-02',
      contactName: '林城西',
      contactPhone: '13900000003',
      licenseNo: '91310000MA1FL0003X',
      province: '上海市',
      city: '上海市',
      district: '普陀区',
      address: '曹杨路 500 号',
      status: MerchantStatus.APPROVED,
      auditedAt: now,
    },
  });

  // 一条「待审核」的入驻申请，供 S1.2 审核流程验收（审核通过后会自动建账号）
  await prisma.merchant.create({
    data: {
      id: ID.MERCHANT_SUB3_PENDING,
      parentId: main.id,
      type: MerchantType.SUB,
      name: '城北便利店',
      code: 'SUB-03',
      contactName: '周城北',
      contactPhone: '13900000004',
      licenseNo: '91310000MA1FL0004X',
      province: '上海市',
      city: '上海市',
      district: '杨浦区',
      address: '控江路 800 号',
      status: MerchantStatus.PENDING,
    },
  });

  // ---------------------------------------------------------------- 门店
  console.log('→ 创建门店 ...');
  const store101 = await prisma.store.create({
    data: {
      id: ID.STORE_101,
      merchantId: sub1.id,
      name: 'S-101 中心店',
      code: 'S-101',
      contactName: '店长-赵',
      contactPhone: '13900000101',
      city: '上海市',
      district: '徐汇区',
      address: '中山南路 200-1 号',
      businessHours: '10:00-22:00',
      status: StoreStatus.OPEN,
    },
  });
  const store102 = await prisma.store.create({
    data: {
      id: ID.STORE_102,
      merchantId: sub1.id,
      name: 'S-102 车站店',
      code: 'S-102',
      contactName: '店长-钱',
      contactPhone: '13900000102',
      city: '上海市',
      district: '徐汇区',
      address: '中山南路 200-2 号',
      businessHours: '09:00-21:00',
      status: StoreStatus.OPEN,
    },
  });
  const store201 = await prisma.store.create({
    data: {
      id: ID.STORE_201,
      merchantId: sub2.id,
      name: 'S-201 社区店',
      code: 'S-201',
      contactName: '店长-孙',
      contactPhone: '13900000201',
      city: '上海市',
      district: '普陀区',
      address: '曹杨路 500-1 号',
      businessHours: '08:00-20:00',
      status: StoreStatus.OPEN,
    },
  });

  // ---------------------------------------------------------------- 权限
  console.log('→ 创建角色与权限 ...');
  const permissionDefs: Array<[string, string, string]> = [
    ['dashboard:view', '查看工作台', 'dashboard'],
    ['merchant:view', '查看商家', 'merchant'],
    ['merchant:audit', '入驻审核', 'merchant'],
    ['merchant:manage', '商家管理', 'merchant'],
    ['store:view', '查看门店', 'store'],
    ['store:manage', '门店管理', 'store'],
    ['store:change-request', '门店变更申请', 'store'],
    ['authorization:view', '查看授权', 'authorization'],
    ['authorization:manage', '授权管理', 'authorization'],
    ['coupon:create', '创建代金券', 'coupon'],
    ['coupon:edit', '编辑代金券（S2.1）', 'coupon'],
    ['coupon:publish', '上架/下架', 'coupon'],
    ['coupon:issue-main', '发放主体商家代金券', 'coupon'],
    ['coupon:view', '查看代金券', 'coupon'],
    // S2.2 券码预生成 + 券实例发放
    ['coupon:code:generate', '预生成券码', 'coupon'],
    ['coupon:issue', '发放自有券', 'coupon'],
    // S2.3/S2.4 核销与券实例管理
    ['redemption:verify', '核销校验 / 执行', 'redemption'],
    ['coupon:instance:view', '查看券实例', 'coupon'],
    ['coupon:instance:freeze', '冻结 / 解冻券实例', 'coupon'],
    ['redemption:create', '核销代金券', 'redemption'],
    ['redemption:view', '查看核销', 'redemption'],
    ['redemption:reverse', '核销冲正', 'redemption'],
    ['point:rule:edit', '积分规则配置', 'point'],
    ['point:adjust', '积分人工调整', 'point'],
    ['point:view', '查看积分流水', 'point'],
    ['order:view', '查看订单', 'order'],
    ['order:handle', '异常订单处理', 'order'],
    ['purchase:manage', '采购记录管理', 'settlement'],
    ['settlement:view', '查看对账', 'settlement'],
    ['settlement:confirm', '确认对账', 'settlement'],
    ['report:view', '查看报表', 'report'],
    ['report:export', '导出报表', 'report'],
    ['user:view', '查看用户', 'user'],
    ['notification:manage', '发布通知', 'notification'],
    ['notification:view', '查看通知', 'notification'],
    // S1.4 起统一用 audit:view（与 GET /audit-logs 的 @Permissions 保持一致）
    ['audit:view', '查看操作日志', 'system'],
    // S3.1 积分（追加在末尾，避免打乱既有权限码的固定主键 1..N）
    ['point:earn', '消费录单送积分', 'point'],
    ['point:rule:view', '查看积分规则', 'point'],
    // S3.2 积分兑换
    ['point:exchange', '积分兑换代金券', 'point'],
    ['point:exchange:view', '查看兑换记录', 'point'],
    // S3.3 积分过期清零（手动触发，定时任务无需权限，但手动触发要走审计）
    ['point:expire:trigger', '积分过期清零（手动触发）', 'point'],
    // S3.4 收紧：附属只能「标记异常」，处理权归主体（order:handle 只给主体/平台）
    ['order:mark-abnormal', '标记异常订单', 'order'],
    // S4.1 采购记录
    ['purchase:create', '新增采购记录', 'settlement'],
    ['purchase:view', '查看采购记录', 'settlement'],
    ['purchase:settle', '采购记录结算', 'settlement'],
    // S4.2 对账账单
    ['settlement:generate', '生成对账单', 'settlement'],
  ];

  const permissionSeeds: Array<{ id: number; code: string; name: string; group: string }> = [];
  const permissions: Record<string, number> = {};
  permissionDefs.forEach(([code, name, group], index) => {
    const id = index + 1; // 固定主键：按清单顺序 1..N
    permissions[code] = id;
    permissionSeeds.push({ id, code, name, group });
  });
  await prisma.permission.createMany({ data: permissionSeeds });

  const mainPerms = permissionDefs.map(([code]) => code);
  const subPerms = [
    'dashboard:view',
    'store:view',
    'store:change-request',
    'coupon:view',
    // S3.1：门店消费录单送积分（店员同样需要），查看积分流水与规则
    'point:earn',
    'point:view',
    'point:rule:view',
    // S3.2：代客积分兑换（H5 用户自助 / 门店代客兑换）
    'point:exchange',
    'point:exchange:view',
    // S2.2：附属商家要能查自己发放 / 自己名下的券实例
    'coupon:instance:view',
    'redemption:create',
    'redemption:view',
    'order:view',
    // S3.4 边界决策：附属只能「标记异常」（order:mark-abnormal），异常处理权归主体（不给 order:handle）
    'order:mark-abnormal',
    // S4.1：附属能录 / 看自己作为 sub_merchant 的采购记录（结算权归主体，不给 purchase:settle）
    'purchase:create',
    'purchase:view',
    'settlement:view',
    // S4.2：对账的「确认 / 异议」权归附属 —— 账单是主体开给附属的，由附属确认或提异议。
    // 生成权 settlement:generate 仍留主体（不给附属），与上一行「结算权归主体」形成对称：
    // 谁出钱谁结算，谁被结算谁确认。
    'settlement:confirm',
    'notification:view',
    // S4.3.2.1：附属可查看（数据隔离到自身）并导出报表
    'report:view',
    'report:export',
  ];
  // sub01 额外拥有：发放主体券（已授权）+ 冻结券 + 核销冲正（S2.3：误核销 / 订单取消要能当场退回）
  const sub1Perms = [
    ...subPerms,
    'coupon:issue-main',
    'coupon:instance:freeze',
    'redemption:verify',
    'redemption:reverse',
  ];
  // S3.1：店员在门店录单送积分（point:earn），但**不能**人工调整积分（point:adjust 不给）
  const clerkPerms = [
    'dashboard:view',
    'redemption:create',
    'redemption:view',
    'order:view',
    'point:earn',
    'point:exchange',
    'point:exchange:view',
    // S4.3.2.1：门店店员可查看（隔离到本店）并导出报表
    'report:view',
    'report:export',
  ];

  const roleDefs: Array<[number, string, string, RoleScope, string[]]> = [
    [ID.ROLE_PLATFORM_ADMIN, 'PLATFORM_ADMIN', '平台管理员', 'PLATFORM', mainPerms],
    [ID.ROLE_MAIN_ADMIN, 'MAIN_ADMIN', '主体商家管理员', 'MERCHANT', mainPerms],
    [ID.ROLE_SUB_ADMIN, 'SUB_ADMIN', '附属商家管理员', 'MERCHANT', sub1Perms],
    [ID.ROLE_SUB_ADMIN_BASIC, 'SUB_ADMIN_BASIC', '附属商家（未授权）', 'MERCHANT', subPerms],
    [ID.ROLE_STORE_CLERK, 'STORE_CLERK', '门店店员', 'STORE', clerkPerms],
  ];

  const roles: Record<string, number> = {};
  const rolePermSeeds: Array<{ roleId: number; permissionId: number }> = [];
  for (const [id, code, name, scope, codes] of roleDefs) {
    roles[code] = id;
    for (const c of codes) {
      rolePermSeeds.push({ roleId: id, permissionId: permissions[c] });
    }
  }
  await prisma.role.createMany({
    data: roleDefs.map(([id, code, name, scope]) => ({ id, code, name, scope: scope as never })),
  });
  await prisma.rolePermission.createMany({ data: rolePermSeeds });

  // ---------------------------------------------------------------- 账号
  console.log('→ 创建账号 ...');
  const pwd = hashSync(PASSWORD, 10);
  const admin = await prisma.adminUser.create({
    data: {
      id: ID.ADMIN,
      username: 'admin',
      passwordHash: pwd,
      realName: '王主体',
      phone: '13900000001',
      merchantId: main.id,
      userType: AdminUserType.MERCHANT,
      roles: { create: [{ roleId: roles['MAIN_ADMIN'] }] },
    },
  });
  await prisma.adminUser.create({
    data: {
      id: ID.ADMIN_SUB01,
      username: 'sub01',
      passwordHash: pwd,
      realName: '陈城南',
      phone: '13900000002',
      merchantId: sub1.id,
      userType: AdminUserType.MERCHANT,
      roles: { create: [{ roleId: roles['SUB_ADMIN'] }] },
    },
  });
  await prisma.adminUser.create({
    data: {
      id: ID.ADMIN_SUB02,
      username: 'sub02',
      passwordHash: pwd,
      realName: '林城西',
      phone: '13900000003',
      merchantId: sub2.id,
      userType: AdminUserType.MERCHANT,
      roles: { create: [{ roleId: roles['SUB_ADMIN_BASIC'] }] },
    },
  });
  // S3.2 新增：平台管理员（merchantId 为空、userType=PLATFORM），
  // 用来验证「平台侧必须显式指定 merchantId」这类分支（如 /points/earn 的 MERCHANT_ID_REQUIRED）
  await prisma.adminUser.create({
    data: {
      id: ID.ADMIN_PLATFORM,
      username: 'platform',
      passwordHash: pwd,
      realName: '平台管理员',
      phone: '13900000000',
      merchantId: null,
      storeId: null,
      userType: AdminUserType.PLATFORM,
      roles: { create: [{ roleId: roles['PLATFORM_ADMIN'] }] },
    },
  });
  await prisma.adminUser.create({
    data: {
      id: ID.ADMIN_CLERK01,
      username: 'clerk01',
      passwordHash: pwd,
      realName: '赵店长',
      phone: '13900000101',
      merchantId: sub1.id,
      storeId: store101.id,
      userType: AdminUserType.STORE,
      roles: { create: [{ roleId: roles['STORE_CLERK'] }] },
    },
  });

  // ---------------------------------------------------------------- 积分规则
  console.log('→ 创建积分规则 ...');
  await prisma.pointRule.create({
    data: {
      merchantId: 0, // 平台级默认
      earnRatio: 1,
      minAmount: 1,
      pointsValidMonths: 12,
      expireMode: ExpireMode.FIXED_MONTHS,
      status: 1,
    },
  });
  await prisma.pointRule.create({
    data: {
      merchantId: main.id,
      earnRatio: 1,
      minAmount: 1,
      pointsValidMonths: 12,
      expireMode: ExpireMode.FIXED_MONTHS,
      status: 1,
    },
  });

  // ---------------------------------------------------------------- 券模板
  console.log('→ 创建代金券模板 ...');
  const t1 = await prisma.couponTemplate.create({
    data: {
      id: ID.TEMPLATE_MAIN_1,
      creatorMerchantId: main.id,
      ownerMerchantId: main.id,
      ownerType: CouponOwnerType.MAIN_COUPON,
      name: 'T1 满100减20',
      subtitle: '全平台通用代金券',
      couponType: CouponType.VOUCHER,
      faceValue: 20,
      thresholdAmount: 100,
      pointsCost: 20,
      purchasePrice: 15,
      totalStock: 500,
      issuedCount: 0,
      validType: ValidType.AFTER_RECEIVE_DAYS,
      validDays: 30,
      applyScope: ApplyScope.ALL_STORES,
      status: CouponTemplateStatus.PUBLISHED,
      description: '满 100 元可用，不兑现不找零',
      rules: '同一订单仅可使用 1 张，不可叠加',
    },
  });
  const t2 = await prisma.couponTemplate.create({
    data: {
      id: ID.TEMPLATE_MAIN_2,
      creatorMerchantId: main.id,
      ownerMerchantId: main.id,
      ownerType: CouponOwnerType.MAIN_COUPON,
      name: 'T2 无门槛5元',
      subtitle: '新手专享',
      couponType: CouponType.VOUCHER,
      faceValue: 5,
      thresholdAmount: 0,
      pointsCost: 5,
      purchasePrice: 4,
      totalStock: 500,
      validType: ValidType.AFTER_RECEIVE_DAYS,
      validDays: 15,
      applyScope: ApplyScope.ALL_STORES,
      status: CouponTemplateStatus.PUBLISHED,
      description: '无门槛代金券',
      rules: '同一订单仅可使用 1 张',
    },
  });
  const t3 = await prisma.couponTemplate.create({
    data: {
      id: ID.TEMPLATE_MAIN_3,
      creatorMerchantId: main.id,
      ownerMerchantId: main.id,
      ownerType: CouponOwnerType.MAIN_COUPON,
      name: 'T3 满200减50（不在授权范围）',
      subtitle: '高门槛券',
      couponType: CouponType.VOUCHER,
      faceValue: 50,
      thresholdAmount: 200,
      pointsCost: 50,
      purchasePrice: 40,
      totalStock: 100,
      validType: ValidType.AFTER_RECEIVE_DAYS,
      validDays: 30,
      applyScope: ApplyScope.ALL_STORES,
      status: CouponTemplateStatus.PUBLISHED,
      description: '未被授权给任何附属商家，仅主体可发放',
    },
  });
  const t4 = await prisma.couponTemplate.create({
    data: {
      id: ID.TEMPLATE_SUB_4,
      creatorMerchantId: main.id, // H1：创建者始终为主体
      ownerMerchantId: sub1.id,
      ownerType: CouponOwnerType.SUB_COUPON,
      name: 'T4 城南店10元代金券',
      subtitle: '附属商家专属券',
      couponType: CouponType.VOUCHER,
      faceValue: 10,
      thresholdAmount: 50,
      pointsCost: 10,
      purchasePrice: 8,
      totalStock: 200,
      validType: ValidType.AFTER_RECEIVE_DAYS,
      validDays: 30,
      applyScope: ApplyScope.SPECIFIED_STORES,
      status: CouponTemplateStatus.PUBLISHED,
      description: '仅限 S-101 中心店使用',
      stores: { create: [{ storeId: store101.id }] },
    },
  });
  // S2.1：草稿态模板，用于验证「仅 DRAFT/UNPUBLISHED 可编辑 → publish 后不可改」
  await prisma.couponTemplate.create({
    data: {
      id: ID.TEMPLATE_MAIN_5_DRAFT,
      creatorMerchantId: main.id,
      ownerMerchantId: main.id,
      ownerType: CouponOwnerType.MAIN_COUPON,
      name: 'T5 春日踏青券（草稿）',
      subtitle: '尚未上架，可直接编辑',
      couponType: CouponType.VOUCHER,
      faceValue: 30,
      thresholdAmount: 150,
      pointsCost: 30,
      purchasePrice: 25,
      totalStock: 300,
      validType: ValidType.AFTER_RECEIVE_DAYS,
      validDays: 30,
      applyScope: ApplyScope.ALL_STORES,
      status: CouponTemplateStatus.DRAFT,
      description: 'S2.1 编辑 / 上架用例的固定样本',
    },
  });

  // ---------------------------------------------------------------- 授权
  console.log('→ 创建授权记录 ...');
  const auth = await prisma.merchantAuthorization.create({
    data: {
      mainMerchantId: main.id,
      subMerchantId: sub1.id,
      authType: AuthType.ISSUE_MAIN_COUPON,
      status: AuthStatus.ENABLED,
      templateScope: TemplateScope.SPECIFIED, // 仅授权 T1、T2
      grantedBy: admin.id,
      grantedAt: now,
      templates: {
        create: [{ templateId: t1.id }, { templateId: t2.id }],
      },
    },
  });
  // SUB-02 不创建授权记录（未授权）

  // ---------------------------------------------------------------- 预生成券码
  console.log('→ 预生成券码 ...');
  const codePlan: Array<[number, string, number]> = [
    [t1.id, 'T1', 50],
    [t2.id, 'T2', 50],
    [t3.id, 'T3', 20],
    [t4.id, 'T4', 30],
  ];
  const codeIds: Record<number, number[]> = {};
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  for (const [templateId, prefix, count] of codePlan) {
    // 批次号格式：{templateId}-{yyyymmdd}-{seq}（与线上 generate() 的自动生成规则一致）
    const batchNo = `${templateId}-${ymd}-001`;
    const batch = await prisma.couponCodeBatch.create({
      data: {
        batchNo,
        templateId,
        quantity: count,
        remark: `${prefix} 首批券码（seed）`,
        operatorId: admin.id,
      },
    });
    const ids: number[] = [];
    for (const code of makeCodes(count)) {
      const c = await prisma.couponCode.create({
        data: {
          code,
          templateId,
          batchNo,
          batchId: batch.id,
          status: CouponCodeStatus.UNISSUED,
        },
      });
      ids.push(c.id);
    }
    codeIds[templateId] = ids;
  }

  // ---------------------------------------------------------------- 用户 / 积分
  console.log('→ 创建用户与积分账户 ...');
  const zhangsan = await prisma.user.create({
    data: {
      id: ID.USER_ZHANGSAN,
      phone: '13800000001',
      nickname: '张三',
      status: 'ACTIVE',
      registeredAt: now,
    },
  });
  const lisi = await prisma.user.create({
    data: {
      id: ID.USER_LISI,
      phone: '13800000002',
      nickname: '李四',
      status: 'ACTIVE',
      registeredAt: now,
    },
  });

  const accountZs = await prisma.pointAccount.create({
    data: {
      userId: zhangsan.id,
      balance: 120,
      totalEarned: 160,
      totalSpent: 40,
      totalExpired: 0,
    },
  });
  const accountLs = await prisma.pointAccount.create({
    data: { userId: lisi.id, balance: 30, totalEarned: 30, totalSpent: 0, totalExpired: 0 },
  });

  // 张三：3 个 EARN 批次（其中 1 个已过期待清零，用于验收 A5） + 1 次消耗
  const earn1 = await prisma.pointTransaction.create({
    data: {
      userId: zhangsan.id,
      accountId: accountZs.id,
      type: PointTxnType.EARN,
      amount: 80,
      remainingAmount: 80,
      balanceAfter: 80,
      expireAt: new Date(now.getTime() - 5 * 24 * 3600 * 1000), // 已过期
      merchantId: sub1.id,
      storeId: store101.id,
      remark: '消费送积分（已过期批次，待清零）',
    },
  });
  const earn2 = await prisma.pointTransaction.create({
    data: {
      userId: zhangsan.id,
      accountId: accountZs.id,
      type: PointTxnType.EARN,
      amount: 60,
      remainingAmount: 20, // 已被消耗 40
      balanceAfter: 140,
      expireAt: addMonths(now, 6),
      merchantId: sub1.id,
      storeId: store101.id,
      remark: '消费送积分',
    },
  });
  await prisma.pointTransaction.create({
    data: {
      userId: zhangsan.id,
      accountId: accountZs.id,
      type: PointTxnType.SPEND,
      amount: -40,
      remainingAmount: 0,
      balanceAfter: 100,
      merchantId: main.id,
      remark: '积分兑换代金券（FIFO 扣减批次）',
      relatedCouponInstanceId: null,
    },
  });
  await prisma.pointTransaction.create({
    data: {
      userId: zhangsan.id,
      accountId: accountZs.id,
      type: PointTxnType.EARN,
      amount: 20,
      remainingAmount: 20,
      balanceAfter: 120,
      expireAt: addMonths(now, 11),
      merchantId: sub2.id,
      storeId: store201.id,
      remark: '消费送积分',
    },
  });

  await prisma.pointTransaction.create({
    data: {
      userId: lisi.id,
      accountId: accountLs.id,
      type: PointTxnType.EARN,
      amount: 30,
      remainingAmount: 30,
      balanceAfter: 30,
      expireAt: addMonths(now, 10),
      merchantId: sub1.id,
      storeId: store102.id,
      remark: '消费送积分',
    },
  });

  // ---------------------------------------------------------------- 券实例
  console.log('→ 创建券实例（含已用 / 未用 / 过期）...');
  // 1) 已使用：张三的 T1 券（兑换获得，已核销）
  const usedInstance = await prisma.couponInstance.create({
    data: {
      userId: zhangsan.id,
      templateId: t1.id,
      code: 'T1-USED-CODE',
      issuerMerchantId: main.id,
      source: CouponSource.EXCHANGE,
      pointsCost: 20,
      status: CouponInstanceStatus.USED,
      obtainedAt: new Date(now.getTime() - 3 * 24 * 3600 * 1000),
      expireAt: addMonths(now, 1),
      usedAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
    },
  });
  // 2) 未使用：张三的 T2 券（兑换获得，绑定预生成券码）
  const codeT2 = await prisma.couponCode.findFirstOrThrow({
    where: { templateId: t2.id, status: CouponCodeStatus.UNISSUED },
  });
  const unusedInstance = await prisma.couponInstance.create({
    data: {
      userId: zhangsan.id,
      templateId: t2.id,
      code: codeT2.code, // 冗余只读展示
      issuerMerchantId: main.id,
      source: CouponSource.EXCHANGE,
      pointsCost: 5,
      status: CouponInstanceStatus.UNUSED,
      obtainedAt: now,
      expireAt: addMonths(now, 1),
    },
  });
  // 单向绑定：仅 coupon_codes.instanceId
  await prisma.couponCode.update({
    where: { id: codeT2.id },
    data: { instanceId: unusedInstance.id, status: CouponCodeStatus.ISSUED },
  });

  // 3) 已过期：张三的 T3 券（用于验收 A4：过期券核销被拒）
  const codeT3 = await prisma.couponCode.findFirstOrThrow({
    where: { templateId: t3.id, status: CouponCodeStatus.UNISSUED },
  });
  const expiredInstance = await prisma.couponInstance.create({
    data: {
      userId: zhangsan.id,
      templateId: t3.id,
      code: codeT3.code,
      issuerMerchantId: main.id,
      source: CouponSource.EXCHANGE,
      pointsCost: 50,
      status: CouponInstanceStatus.EXPIRED,
      obtainedAt: new Date(now.getTime() - 60 * 24 * 3600 * 1000),
      expireAt: new Date(now.getTime() - 30 * 24 * 3600 * 1000),
    },
  });
  await prisma.couponCode.update({
    where: { id: codeT3.id },
    data: { instanceId: expiredInstance.id, status: CouponCodeStatus.ISSUED },
  });

  // 4) 李四未使用的 T2 券
  const codeT2b = await prisma.couponCode.findFirstOrThrow({
    where: { templateId: t2.id, status: CouponCodeStatus.UNISSUED },
  });
  const lisiInstance = await prisma.couponInstance.create({
    data: {
      userId: lisi.id,
      templateId: t2.id,
      code: codeT2b.code,
      issuerMerchantId: sub1.id, // 附属商家（已授权）发放
      source: CouponSource.MERCHANT_ISSUE,
      pointsCost: 0,
      status: CouponInstanceStatus.UNUSED,
      obtainedAt: now,
      expireAt: addMonths(now, 1),
    },
  });
  await prisma.couponCode.update({
    where: { id: codeT2b.id },
    data: { instanceId: lisiInstance.id, status: CouponCodeStatus.ISSUED },
  });

  // 更新模板发放计数
  await prisma.couponTemplate.update({
    where: { id: t1.id },
    data: { issuedCount: 1, usedCount: 1 },
  });
  await prisma.couponTemplate.update({ where: { id: t2.id }, data: { issuedCount: 2 } });
  await prisma.couponTemplate.update({ where: { id: t3.id }, data: { issuedCount: 1 } });

  // ---------------------------------------------------------------- 订单
  console.log('→ 创建订单 ...');
  const order1 = await prisma.order.create({
    data: {
      orderNo: 'ORD20260101001',
      userId: zhangsan.id,
      merchantId: sub1.id,
      storeId: store101.id,
      orderType: OrderType.CONSUME,
      totalAmount: 128,
      discountAmount: 20,
      payAmount: 108,
      couponInstanceId: usedInstance.id, // 一单一券
      pointsEarned: 108,
      status: OrderStatus.NORMAL,
      source: OrderSource.APPLET,
      consumeTime: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
    },
  });
  await prisma.order.create({
    data: {
      orderNo: 'ORD20260101002',
      userId: zhangsan.id,
      merchantId: sub2.id,
      storeId: store201.id,
      orderType: OrderType.CONSUME,
      totalAmount: 60,
      discountAmount: 0,
      payAmount: 60,
      pointsEarned: 60,
      status: OrderStatus.NORMAL,
      source: OrderSource.APPLET,
      consumeTime: new Date(now.getTime() - 1 * 24 * 3600 * 1000),
    },
  });
  await prisma.order.create({
    data: {
      orderNo: 'ORD20260101003',
      userId: lisi.id,
      merchantId: sub1.id,
      storeId: store102.id,
      orderType: OrderType.CONSUME,
      totalAmount: 30,
      discountAmount: 0,
      payAmount: 30,
      pointsEarned: 30,
      status: OrderStatus.ABNORMAL,
      abnormalType: 'AMOUNT_DISPUTE',
      abnormalRemark: '顾客反馈金额与实际不符，待核实',
      source: OrderSource.APPLET,
      consumeTime: now,
    },
  });
  await prisma.order.create({
    data: {
      orderNo: 'EXC20260101001',
      userId: zhangsan.id,
      merchantId: main.id,
      orderType: OrderType.EXCHANGE,
      totalAmount: 0,
      payAmount: 5,
      pointsEarned: 0,
      status: OrderStatus.NORMAL,
      source: OrderSource.WEB,
      consumeTime: now,
    },
  });

  // ---------------------------------------------------------------- 核销记录
  console.log('→ 创建核销记录 ...');
  await prisma.redemptionRecord.create({
    data: {
      couponInstanceId: usedInstance.id,
      code: 'T1-USED-CODE',
      userId: zhangsan.id,
      storeId: store101.id,
      merchantId: sub1.id,
      operatorId: null,
      templateId: t1.id,
      faceValue: 20,
      discountAmount: 20,
      orderId: order1.id,
      channel: RedemptionChannel.MANUAL,
      status: RedemptionStatus.SUCCESS,
      redeemedAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
    },
  });
  await prisma.couponCode.updateMany({
    where: { instanceId: usedInstance.id },
    data: { status: CouponCodeStatus.REDEEMED },
  });

  // ---------------------------------------------------------------- 采购 / 对账
  console.log('→ 创建采购与对账数据 ...');
  await prisma.purchaseRecord.create({
    data: {
      purchaseNo: 'PU20260101001',
      subMerchantId: sub1.id,
      mainMerchantId: main.id,
      templateId: t1.id,
      quantity: 100,
      unitPrice: 15,
      totalAmount: 1500,
      settleStatus: SettleStatus.UNSETTLED,
      purchasedAt: new Date(now.getTime() - 10 * 24 * 3600 * 1000),
      operatorId: admin.id,
    },
  });
  await prisma.purchaseRecord.create({
    data: {
      purchaseNo: 'PU20260101002',
      subMerchantId: sub2.id,
      mainMerchantId: main.id,
      templateId: t2.id,
      quantity: 50,
      unitPrice: 4,
      totalAmount: 200,
      settleStatus: SettleStatus.SETTLED,
      settleRemark: '线下转账已结清',
      purchasedAt: new Date(now.getTime() - 20 * 24 * 3600 * 1000),
      operatorId: admin.id,
    },
  });

  // ---------------------------------------------------------------- 通知 / 日志 / 变更申请
  console.log('→ 创建通知、日志与变更申请 ...');
  await prisma.notification.createMany({
    data: [
      {
        receiverType: ReceiverType.MERCHANT,
        receiverId: main.id,
        type: NotificationType.ABNORMAL_ORDER,
        title: '存在 1 笔异常订单待处理',
        content: '订单 ORD20260101003 被标记为金额争议，请及时处理。',
        level: NotifyLevel.IMPORTANT,
        bizType: 'ORDER',
        readStatus: ReadStatus.UNREAD,
      },
      {
        receiverType: ReceiverType.MERCHANT,
        receiverId: sub1.id,
        type: NotificationType.AUTH_CHANGE,
        title: '已开通「发放主体商家代金券」权限',
        content: '可发放范围：T1 满100减20、T2 无门槛5元。',
        level: NotifyLevel.NORMAL,
        bizType: 'AUTH',
        bizId: auth.id,
        readStatus: ReadStatus.READ,
        readAt: now,
      },
      {
        receiverType: ReceiverType.MERCHANT,
        receiverId: sub2.id,
        type: NotificationType.SYSTEM,
        title: '欢迎入驻星链商盟',
        content: '门店资料已审核通过，可开始核销代金券。',
        level: NotifyLevel.NORMAL,
        readStatus: ReadStatus.READ,
        readAt: now,
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      operatorId: admin.id,
      operatorType: 'MERCHANT',
      operatorName: '王主体',
      module: 'authorization',
      action: 'GRANT',
      targetType: 'MERCHANT',
      targetId: sub1.id,
      afterData: { authType: 'ISSUE_MAIN_COUPON', templateScope: 'SPECIFIED' },
      result: 'SUCCESS',
    },
  });

  await prisma.storeChangeRequest.create({
    data: {
      storeId: store101.id,
      merchantId: sub1.id,
      applicantId: null,
      changes: {
        businessHours: { old: '09:00-21:00', new: '10:00-22:00' },
        contactPhone: { old: '13900000100', new: '13900000101' },
      },
      reason: '门店营业时间调整',
      status: ChangeStatus.PENDING,
    },
  });

  console.log('\n✅ Seed 完成！\n');
  console.log(`演示账号（密码均为 ${PASSWORD}）：`);
  console.log(`  admin   / ${PASSWORD}   主体商家管理员（全平台）  id=${ID.ADMIN} merchantId=${ID.MERCHANT_MAIN}`);
  console.log(`  sub01   / ${PASSWORD}   附属商家 · 城南旗舰店（已授权发主体券）  id=${ID.ADMIN_SUB01} merchantId=${ID.MERCHANT_SUB1}`);
  console.log(`  sub02   / ${PASSWORD}   附属商家 · 城西社区店（未授权）  id=${ID.ADMIN_SUB02} merchantId=${ID.MERCHANT_SUB2}`);
  console.log(`  clerk01 / ${PASSWORD}   店员 · S-101 中心店  id=${ID.ADMIN_CLERK01} merchantId=${ID.MERCHANT_SUB1} storeId=${ID.STORE_101}`);
  console.log('\n主键固定，重跑 seed 不会变化（详见 docs/06-验收清单.md 的「稳定 ID 对照表」）');
  console.log('\n可用于验收的数据：');
  console.log(`  未使用券码（T2）：${codeT2.code}  → 可在 /sub/redeem 核销`);
  console.log(`  过期券码（T3） ：${codeT3.code}  → 核销应被拒 COUPON_EXPIRED`);
  console.log(`  张三积分账户   ：balance=120（含 80 分已过期批次，执行过期任务后应变为 40）`);
  console.log(`  授权记录       ：#${auth.id} SUB-01 → T1/T2（T3 不在范围内）`);
  console.log('\n券模板固定 ID（后续用例/文档示例直接写死，不要再查：）');
  console.log(`  主体券 T1 满100减20              id=${ID.TEMPLATE_MAIN_1}`);
  console.log(`  主体券 T2 无门槛5元              id=${ID.TEMPLATE_MAIN_2}`);
  console.log(`  主体券 T3 满200减50（未授权）    id=${ID.TEMPLATE_MAIN_3}`);
  console.log(`  附属券 T4 城南店10元代金券       id=${ID.TEMPLATE_SUB_4}`);
  console.log(`  主体券 T5 春日踏青券（草稿）     id=${ID.TEMPLATE_MAIN_5_DRAFT}  → 编辑/上架用例样本`);
  console.log(`  当前授权范围（SUB-01）：[${ID.TEMPLATE_MAIN_1}, ${ID.TEMPLATE_MAIN_2}]`);
}

main()
  .catch((e) => {
    console.error('❌ Seed 失败：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
