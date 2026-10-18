import { Injectable } from '@nestjs/common';
import { BizException, ReasonCode } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload';
import { UserJwtPayload } from '../auth/user-jwt-payload';
import { ExchangePointsDto, QueryExchangeRecordsDto, QueryPointTransactionsDto } from '../point/dto/point.dto';
import { PointService } from '../point/point.service';

/**
 * H5 / C 端业务服务（S5.1）
 *
 * 所有读写都以 **令牌里的 userId** 为准（`p.userId`），**不接受**前端传入的 userId；
 * 兑换时若请求体带了 `userId` 且与令牌不一致 → 403（防伪造）。
 *
 * 复用 S3 的 `PointService`：给其传一个「PLATFORM 视角」的合成身份 + 强制 userId，
 * 等价于「只能操作自己」的隔离（因为 userId 已被令牌锁定）。
 */
@Injectable()
export class H5Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointService,
  ) {}

  /** 把 C 端身份包装成 PointService 期望的 scope 身份（PLATFORM=不额外限制，安全性由「userId 锁定」保证） */
  private scope(p: UserJwtPayload): JwtPayload {
    return {
      sub: p.userId,
      username: `user:${p.userId}`,
      merchantId: null,
      storeId: null,
      userType: 'PLATFORM',
      roles: [],
      permissions: [],
    };
  }

  async me(p: UserJwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: p.userId },
      select: { id: true, nickname: true, phone: true, avatar: true, openid: true, unionid: true, status: true, registeredAt: true },
    });
    if (!user) throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, '用户不存在');
    return user;
  }

  /** 我的积分账户（余额 + 批次明细 + 可用/临期） */
  async account(p: UserJwtPayload) {
    return this.points.accountDetail(p.userId, this.scope(p));
  }

  /** 我的积分流水 */
  async transactions(p: UserJwtPayload, query: QueryPointTransactionsDto) {
    return this.points.listTransactions({ ...query, userId: p.userId, merchantId: undefined, storeId: undefined }, this.scope(p));
  }

  /** 我的兑换记录 */
  async exchangeRecords(p: UserJwtPayload, query: QueryExchangeRecordsDto) {
    return this.points.listExchangeRecords({ ...query, userId: p.userId }, this.scope(p));
  }

  /** 可兑换券（已上架 + 设了兑换积分 + 有库存），分页给小程序列表用。 */
  async couponTemplates(page = 1, pageSize = 10) {
    const all = (await this.templates()).list;
    const size = Math.min(Math.max(pageSize, 1), 20);
    const current = Math.max(page, 1);
    const start = (current - 1) * size;
    return { list: all.slice(start, start + size), total: all.length, page: current, pageSize: size };
  }

  /** 我的卡包。未使用只含未过期；已过期含状态过期和未使用但已过有效期。 */
  async myCoupons(p: UserJwtPayload, status: string, page = 1, pageSize = 10) {
    const size = Math.min(Math.max(pageSize, 1), 20);
    const current = Math.max(page, 1);
    const now = new Date();
    const where =
      status === 'USED'
        ? { userId: p.userId, status: 'USED' as const }
        : status === 'EXPIRED'
          ? {
              userId: p.userId,
              OR: [{ status: 'EXPIRED' as const }, { status: 'UNUSED' as const, expireAt: { lte: now } }],
            }
          : { userId: p.userId, status: 'UNUSED' as const, expireAt: { gt: now } };
    const [rows, total] = await Promise.all([
      this.prisma.couponInstance.findMany({
        where,
        include: { template: { select: { name: true, faceValue: true, subtitle: true } } },
        orderBy: { id: 'desc' },
        skip: (current - 1) * size,
        take: size,
      }),
      this.prisma.couponInstance.count({ where }),
    ]);
    return {
      list: rows.map((row) => ({
        id: row.id,
        code: row.code,
        status: row.status,
        name: row.template?.name ?? '代金券',
        subtitle: row.template?.subtitle ?? '',
        faceValue: Number(row.template?.faceValue ?? 0),
        expireAt: row.expireAt,
        usedAt: row.usedAt,
      })),
      total,
      page: current,
      pageSize: size,
    };
  }

  /** 可兑换券（已上架 + 设了兑换积分 + 有库存） */
  async templates() {
    const rows = await this.prisma.couponTemplate.findMany({
      where: { status: 'PUBLISHED', pointsCost: { gt: 0 } },
      orderBy: { id: 'asc' },
    });
    return {
      list: rows
        .filter((t) => t.totalStock - t.issuedCount > 0)
        .map((t) => ({
          id: t.id,
          name: t.name,
          subtitle: t.subtitle,
          status: t.status,
          faceValue: Number(t.faceValue),
          thresholdAmount: Number(t.thresholdAmount),
          pointsCost: t.pointsCost,
          perUserLimit: t.perUserLimit,
          totalStock: t.totalStock,
          remainingStock: t.totalStock - t.issuedCount,
        })),
    };
  }

  /** 积分兑换（userId 锁定为令牌用户；伪造 userId → 403） */
  async exchange(p: UserJwtPayload, dto: ExchangePointsDto) {
    const forged = (dto as { userId?: number }).userId;
    if (forged && forged !== p.userId) {
      throw BizException.forbidden(ReasonCode.FORBIDDEN_SCOPE, '不能为其它用户兑换积分');
    }
    return this.points.exchange(
      { userId: p.userId, templateId: dto.templateId, requestId: dto.requestId, channel: dto.channel ?? 'H5', remark: dto.remark },
      this.scope(p),
    );
  }
}
