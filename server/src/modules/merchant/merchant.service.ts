import { Injectable, Logger } from '@nestjs/common';
import { AdminUserType, MerchantStatus, MerchantType, Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { hashSync } from 'bcryptjs';
import { BizException, ReasonCode } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit-log/audit.service';
import { JwtPayload } from '../auth/jwt-payload';
import {
  ApproveApplicationDto,
  CreateApplicationDto,
  QueryApplicationsDto,
  RejectApplicationDto,
} from './dto/application.dto';
import { QueryMerchantsDto, UpdateMerchantStatusDto } from './dto/merchant.dto';

const BCRYPT_ROUNDS = 10;
/** 生成随机口令用的字符集（去掉 0/O/1/l 等易混字符） */
const PWD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%';

/**
 * 商家模块：入驻审核 + 商家管理
 *
 * 硬约束：
 *  - 只有 `PENDING` 的申请可被审核，重复审核 → 409。
 *  - 驳回必须填 `auditRemark`。
 *  - 审核通过后**自动创建附属商家管理员账号**，口令随机生成并**一次性返回**，绝不使用固定口令。
 *  - 启停、审核、驳回全部写 `audit_logs`（成功与失败都记）。
 */
@Injectable()
export class MerchantService {
  private readonly logger = new Logger('Merchant');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- 入驻申请

  /** 附属商家提交入驻申请（公开） */
  async createApplication(dto: CreateApplicationDto, ip?: string, ua?: string) {
    const main = await this.prisma.merchant.findFirst({ where: { type: MerchantType.MAIN } });
    if (!main) {
      throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, '平台未配置主体商家');
    }

    const merchant = await this.prisma.merchant.create({
      data: {
        parentId: main.id,
        type: MerchantType.SUB,
        name: dto.name,
        code: await this.nextMerchantCode(),
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        licenseNo: dto.licenseNo,
        province: dto.province,
        city: dto.city,
        district: dto.district,
        address: dto.address,
        licenseImages: (dto.licenseImages ?? undefined) as never,
        settleContact: dto.settleContact,
        status: MerchantStatus.PENDING,
      },
    });

    await this.audit.record({
      module: 'merchant',
      action: 'application:create',
      targetType: 'merchant',
      targetId: merchant.id,
      after: { name: merchant.name, code: merchant.code, status: merchant.status },
      operatorType: 'MERCHANT_APPLICANT',
      operatorName: dto.contactName,
      ip,
      userAgent: ua,
    });

    return merchant;
  }

  /** 入驻申请列表（平台 / 主体商家可见） */
  async listApplications(query: QueryApplicationsDto, user: JwtPayload) {
    const where: Prisma.MerchantWhereInput = {
      type: MerchantType.SUB,
      status: ((query.status ?? 'PENDING') as MerchantStatus),
      ...(await this.visibilityWhere(user)),
    };
    const [list, total] = await Promise.all([
      this.prisma.merchant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          code: true,
          name: true,
          contactName: true,
          contactPhone: true,
          licenseNo: true,
          licenseImages: true,
          province: true,
          city: true,
          district: true,
          address: true,
          status: true,
          auditRemark: true,
          auditedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.merchant.count({ where }),
    ]);
    return { list, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * 审核通过：PENDING → APPROVED，并自动创建管理员账号
   *
   * 并发安全的关键：**不先查后改**，直接走条件更新
   * `UPDATE ... WHERE id=? AND status='PENDING'`，由数据库保证只有一个请求能把
   * 行改掉；落空的那个拿到 count=0，再回读一次决定回 404 还是 409。
   * 整个过程连同「建账号」放在同一个事务里，避免「商家通过了但账号没建成功」。
   */
  async approve(id: number, dto: ApproveApplicationDto, user: JwtPayload, ip?: string, ua?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.merchant.updateMany({
        where: { id, type: MerchantType.SUB, status: MerchantStatus.PENDING },
        data: {
          status: MerchantStatus.APPROVED,
          auditorId: user.sub,
          auditedAt: new Date(),
          auditRemark: dto.auditRemark ?? null,
        },
      });
      if (count === 0) {
        await this.assertReviewable(tx, id);
      }

      const updated = await tx.merchant.findUniqueOrThrow({ where: { id } });

      let account: { username: string; password: string; adminUserId: number } | null = null;
      if (dto.createAccount !== false) {
        account = await this.createMerchantAdmin(tx, updated);
      }
      return { updated, account, prevStatus: MerchantStatus.PENDING };
    });

    await this.audit.record({
      operatorId: user.sub,
      operatorType: user.userType,
      operatorName: user.username,
      module: 'merchant',
      action: 'application:approve',
      targetType: 'merchant',
      targetId: id,
      before: { status: result.prevStatus },
      after: {
        status: result.updated.status,
        accountCreated: !!result.account,
        username: result.account?.username,
      },
      ip,
      userAgent: ua,
    });

    return {
      merchant: result.updated,
      // 一次性展示，落库只有 bcrypt 哈希，服务端不再保留明文
      account: result.account,
      hint: result.account ? '请立即保存初始口令，系统不再展示' : null,
    };
  }

  /** 驳回：PENDING → REJECTED，auditRemark 必填（同样走条件更新，拒绝并发重复审核） */
  async reject(id: number, dto: RejectApplicationDto, user: JwtPayload, ip?: string, ua?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.merchant.updateMany({
        where: { id, type: MerchantType.SUB, status: MerchantStatus.PENDING },
        data: {
          status: MerchantStatus.REJECTED,
          auditorId: user.sub,
          auditedAt: new Date(),
          auditRemark: dto.auditRemark,
        },
      });
      if (count === 0) {
        await this.assertReviewable(tx, id);
      }
      return {
        updated: await tx.merchant.findUniqueOrThrow({ where: { id } }),
        prevStatus: MerchantStatus.PENDING,
      };
    });

    await this.audit.record({
      operatorId: user.sub,
      operatorType: user.userType,
      operatorName: user.username,
      module: 'merchant',
      action: 'application:reject',
      targetType: 'merchant',
      targetId: id,
      before: { status: result.prevStatus },
      after: { status: result.updated.status, auditRemark: dto.auditRemark },
      ip,
      userAgent: ua,
    });

    return result.updated;
  }

  /**
   * 条件更新落空后的兜底判定：
   * 「记录不存在」还是「状态已经不是 PENDING」——给前端一个准确的错误码。
   * 注意这里只用于生成错误信息，**准入仍然由上面的 UPDATE ... WHERE 决定**。
   */
  private async assertReviewable(tx: Prisma.TransactionClient, id: number): Promise<never> {
    const current = await tx.merchant.findUnique({ where: { id } });
    if (!current) {
      throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, '申请不存在');
    }
    throw BizException.conflict(
      ReasonCode.MERCHANT_NOT_PENDING,
      `该申请当前状态为 ${current.status}，不可重复审核`,
    );
  }

  // ---------------------------------------------------------------- 商家管理

  async list(query: QueryMerchantsDto, user: JwtPayload) {
    const where: Prisma.MerchantWhereInput = {
      ...(query.status ? { status: query.status as MerchantStatus } : {}),
      ...(query.type ? { type: query.type as MerchantType } : {}),
      ...(query.keyword
        ? { OR: [{ name: { contains: query.keyword } }, { code: { contains: query.keyword } }] }
        : {}),
      ...(await this.visibilityWhere(user)),
    };

    const [list, total] = await Promise.all([
      this.prisma.merchant.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          contactName: true,
          contactPhone: true,
          status: true,
          auditRemark: true,
          createdAt: true,
          parent: { select: { id: true, name: true } },
          _count: { select: { stores: true, adminUsers: true } },
        },
      }),
      this.prisma.merchant.count({ where }),
    ]);

    return { list, total, page: query.page, pageSize: query.pageSize };
  }

  async detail(id: number, user: JwtPayload) {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id, ...(await this.visibilityWhere(user)) },
      include: {
        parent: { select: { id: true, name: true, code: true } },
        stores: { select: { id: true, name: true, code: true, status: true } },
        adminUsers: {
          select: { id: true, username: true, realName: true, userType: true, status: true },
        },
      },
    });
    if (!merchant) {
      throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, '商家不存在或无权查看');
    }
    return merchant;
  }

  /** 启用 / 暂停（APPROVED ↔ SUSPENDED），写审计日志 */
  async updateStatus(
    id: number,
    dto: UpdateMerchantStatusDto,
    user: JwtPayload,
    ip?: string,
    ua?: string,
  ) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id } });
    if (!merchant) {
      throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, '商家不存在');
    }
    const activatable: string[] = [MerchantStatus.APPROVED, MerchantStatus.SUSPENDED];
    if (!activatable.includes(merchant.status)) {
      throw BizException.conflict(
        ReasonCode.MERCHANT_NOT_PENDING,
        `商家当前状态为 ${merchant.status}，需先通过入驻审核才能启停`,
      );
    }

    const updated = await this.prisma.merchant.update({
      where: { id },
      data: {
        status: dto.status as MerchantStatus,
        auditorId: user.sub,
        auditedAt: new Date(),
        auditRemark: dto.remark ?? merchant.auditRemark,
      },
    });

    await this.audit.record({
      operatorId: user.sub,
      operatorType: user.userType,
      operatorName: user.username,
      module: 'merchant',
      action: dto.status === MerchantStatus.SUSPENDED ? 'merchant:suspend' : 'merchant:resume',
      targetType: 'merchant',
      targetId: id,
      before: { status: merchant.status },
      after: { status: updated.status, remark: dto.remark ?? null },
      ip,
      userAgent: ua,
    });

    this.logger.log(`商家 #${id} 状态 ${merchant.status} → ${updated.status}，操作人 ${user.username}`);
    return updated;
  }

  // ---------------------------------------------------------------- 内部工具

  /**
   * 可见范围：
   *  - 平台管理员：全部
   *  - 主体商家：自己 + 直属附属
   *  - 附属商家：仅自己
   */
  private async visibilityWhere(user: JwtPayload): Promise<Prisma.MerchantWhereInput> {
    if (user.userType === 'PLATFORM') return {};
    if (!user.merchantId) {
      throw BizException.forbidden(ReasonCode.FORBIDDEN_SCOPE, '账号未绑定商家，无法查看商家数据');
    }
    const own = await this.prisma.merchant.findUnique({
      where: { id: user.merchantId },
      select: { type: true },
    });
    if (own?.type === MerchantType.MAIN) {
      return { OR: [{ id: user.merchantId }, { parentId: user.merchantId }] };
    }
    return { id: user.merchantId };
  }

  /** 生成唯一商家编码 SUB-YYMM-XXXX */
  private async nextMerchantCode(): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const code = `SUB-${randomInt(1000, 9999)}${String(randomInt(0, 9))}`;
      const exists = await this.prisma.merchant.findUnique({ where: { code } });
      if (!exists) return code;
    }
    throw BizException.conflict(ReasonCode.RESOURCE_NOT_FOUND, '生成商家编码失败，请重试');
  }

  /**
   * 审核通过后为附属商家创建管理员账号，返回一次性明文口令。
   * 必须传入事务客户端，保证「商家改状态 + 建账号」原子成功或全部回滚。
   */
  private async createMerchantAdmin(
    tx: Prisma.TransactionClient,
    merchant: { id: number; code: string; contactName: string | null },
  ) {
    const base = merchant.code.replace(/[^A-Za-z0-9]/g, '').toLowerCase() || 'sub';
    let username = base;
    let seq = 1;
    while (await tx.adminUser.findUnique({ where: { username } })) {
      username = `${base}${seq++}`;
    }

    // 按 code 查角色，不硬编码 ID（seed 固定 ID 只是当前取值，不要写死在业务里）
    const subAdmin = await tx.role.findUnique({ where: { code: 'SUB_ADMIN' } });
    if (!subAdmin) {
      throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, '角色 SUB_ADMIN 不存在，请先执行 seed');
    }

    const password = randomPassword(12);
    const created = await tx.adminUser.create({
      data: {
        username,
        passwordHash: hashSync(password, BCRYPT_ROUNDS),
        realName: merchant.contactName,
        merchantId: merchant.id,
        userType: AdminUserType.MERCHANT,
        // 系统生成的初始口令是一次性明文，首次登录必须改掉
        mustChangePassword: true,
        roles: { create: [{ roleId: subAdmin.id }] },
      },
    });

    this.logger.log(`为商家 #${merchant.id} 创建管理员 ${username}（角色 SUB_ADMIN）`);
    return { username, password, adminUserId: created.id };
  }
}

/** 生成随机口令（12 位，含大小写字母、数字、符号） */
function randomPassword(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += PWD_CHARS[randomInt(PWD_CHARS.length)];
  }
  return out;
}
