import { Injectable } from '@nestjs/common';
import {
  MerchantStatus,
  MerchantType,
  NotificationType,
  NotifyLevel,
  Prisma,
  ReadStatus,
  ReceiverType,
  StoreStatus,
} from '@prisma/client';
import { BizException, ReasonCode } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit-log/audit.service';
import { JwtPayload } from '../auth/jwt-payload';
import { QueryNotificationDto, SendNotificationDto } from './dto/notification.dto';

/**
 * 站内信（S5.4-A）
 *
 * 接收侧隔离（receiverType + receiverId 双维度，一律由 JWT 推导）：
 *  - 店员           = (STORE, 本门店)
 *  - 主体 / 附属商家 = (MERCHANT, 本商家) ∪ (STORE, 本商家旗下门店)
 *  - 平台账号        无接收身份 → 列表恒为空
 * 不在接收身份内的通知一律 404（不泄露存在性）。
 *
 * 发布侧：仅平台 / 主体（`notification:send` + 本服务二次断言），
 * 目标只能是本主体直属附属商家及其门店（平台 = 全部附属）。
 */
@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async receiverWhere(user: JwtPayload): Promise<Prisma.NotificationWhereInput | null> {
    if (user.userType === 'STORE') {
      return user.storeId ? { receiverType: ReceiverType.STORE, receiverId: user.storeId } : null;
    }
    if (user.userType !== 'MERCHANT' || !user.merchantId) return null;

    const stores = await this.prisma.store.findMany({
      where: { merchantId: user.merchantId },
      select: { id: true },
    });
    const or: Prisma.NotificationWhereInput[] = [
      { receiverType: ReceiverType.MERCHANT, receiverId: user.merchantId },
    ];
    if (stores.length) {
      or.push({ receiverType: ReceiverType.STORE, receiverId: { in: stores.map((s) => s.id) } });
    }
    return { OR: or };
  }

  /** 发布方可触达的附属商家范围；附属 / 店员 → 403 */
  private async senderMerchantScope(user: JwtPayload): Promise<Prisma.MerchantWhereInput> {
    if (user.userType === 'PLATFORM') return { type: MerchantType.SUB };
    if (user.userType === 'MERCHANT' && user.merchantId) {
      const me = await this.prisma.merchant.findUnique({
        where: { id: user.merchantId },
        select: { type: true },
      });
      if (me?.type === MerchantType.MAIN) return { type: MerchantType.SUB, parentId: user.merchantId };
    }
    throw BizException.forbidden(ReasonCode.FORBIDDEN_SCOPE, '通知由主体商家发布');
  }

  private requireIds(dto: SendNotificationDto): number[] {
    if (!dto.targetIds?.length) {
      throw BizException.badRequest(
        ReasonCode.NOTIFICATION_TARGET_REQUIRED,
        `targetType=${dto.targetType} 时必须传 targetIds`,
      );
    }
    return [...new Set(dto.targetIds)];
  }

  private async resolveReceivers(
    dto: SendNotificationDto,
    scope: Prisma.MerchantWhereInput,
  ): Promise<{ receiverType: ReceiverType; receiverIds: number[] }> {
    if ((dto.targetType === 'ALL_MERCHANTS' || dto.targetType === 'ALL_STORES') && dto.targetIds?.length) {
      throw BizException.badRequest(
        ReasonCode.NOTIFICATION_TARGET_INVALID,
        `targetType=${dto.targetType} 时不可传 targetIds`,
      );
    }

    switch (dto.targetType) {
      case 'MERCHANT': {
        const ids = this.requireIds(dto);
        const rows = await this.prisma.merchant.findMany({
          where: { AND: [scope, { id: { in: ids } }] },
          select: { id: true },
        });
        const found = new Set(rows.map((r) => r.id));
        const missing = ids.filter((id) => !found.has(id));
        if (missing.length) {
          throw BizException.forbidden(
            ReasonCode.FORBIDDEN_SCOPE,
            `以下商家不在可发布范围内：${missing.join(', ')}`,
          );
        }
        return { receiverType: ReceiverType.MERCHANT, receiverIds: ids };
      }
      case 'STORE': {
        const ids = this.requireIds(dto);
        const rows = await this.prisma.store.findMany({
          where: { id: { in: ids }, merchant: scope },
          select: { id: true },
        });
        const found = new Set(rows.map((r) => r.id));
        const missing = ids.filter((id) => !found.has(id));
        if (missing.length) {
          throw BizException.forbidden(
            ReasonCode.STORE_NOT_OWNED,
            `以下门店不在可发布范围内：${missing.join(', ')}`,
          );
        }
        return { receiverType: ReceiverType.STORE, receiverIds: ids };
      }
      case 'ALL_MERCHANTS': {
        const rows = await this.prisma.merchant.findMany({
          where: { AND: [scope, { status: MerchantStatus.APPROVED }] },
          select: { id: true },
          orderBy: { id: 'asc' },
        });
        return { receiverType: ReceiverType.MERCHANT, receiverIds: rows.map((r) => r.id) };
      }
      case 'ALL_STORES': {
        const rows = await this.prisma.store.findMany({
          where: {
            status: StoreStatus.OPEN,
            merchant: { AND: [scope, { status: MerchantStatus.APPROVED }] },
          },
          select: { id: true },
          orderBy: { id: 'asc' },
        });
        return { receiverType: ReceiverType.STORE, receiverIds: rows.map((r) => r.id) };
      }
    }
  }

  // ---------------------------------------------------------------- 接收侧

  async list(query: QueryNotificationDto, user: JwtPayload) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const mine = await this.receiverWhere(user);
    if (!mine) return { list: [], total: 0, page, pageSize, unreadCount: 0 };

    const where: Prisma.NotificationWhereInput = {
      AND: [
        mine,
        {
          ...(query.readStatus ? { readStatus: query.readStatus } : {}),
          ...(query.type ? { type: query.type } : {}),
        },
      ],
    };
    const [list, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { AND: [mine, { readStatus: ReadStatus.UNREAD }] } }),
    ]);
    return { list, total, page, pageSize, unreadCount };
  }

  async unreadCount(user: JwtPayload) {
    const mine = await this.receiverWhere(user);
    if (!mine) return { unreadCount: 0 };
    const unreadCount = await this.prisma.notification.count({
      where: { AND: [mine, { readStatus: ReadStatus.UNREAD }] },
    });
    return { unreadCount };
  }

  /** 已读幂等：重复标记返回 200 + alreadyRead=true */
  async markRead(id: number, user: JwtPayload) {
    const mine = await this.receiverWhere(user);
    if (!mine) throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, '通知不存在');

    const { count } = await this.prisma.notification.updateMany({
      where: { AND: [mine, { id, readStatus: ReadStatus.UNREAD }] },
      data: { readStatus: ReadStatus.READ, readAt: new Date() },
    });
    const row = await this.prisma.notification.findFirst({ where: { AND: [mine, { id }] } });
    if (!row) throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, '通知不存在');
    return { ...row, alreadyRead: count === 0 };
  }

  async markAllRead(user: JwtPayload) {
    const mine = await this.receiverWhere(user);
    if (!mine) return { updated: 0 };
    const { count } = await this.prisma.notification.updateMany({
      where: { AND: [mine, { readStatus: ReadStatus.UNREAD }] },
      data: { readStatus: ReadStatus.READ, readAt: new Date() },
    });
    return { updated: count };
  }

  // ---------------------------------------------------------------- 发布侧

  async send(dto: SendNotificationDto, user: JwtPayload, ip?: string, ua?: string) {
    const scope = await this.senderMerchantScope(user);
    const { receiverType, receiverIds } = await this.resolveReceivers(dto, scope);
    if (!receiverIds.length) {
      throw BizException.badRequest(ReasonCode.NOTIFICATION_NO_RECEIVER, '没有符合条件的接收方');
    }

    const type = dto.type ?? NotificationType.SYSTEM;
    const level = dto.level ?? NotifyLevel.NORMAL;

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.notification.createMany({
        data: receiverIds.map((receiverId) => ({
          receiverType,
          receiverId,
          type,
          level,
          title: dto.title,
          content: dto.content,
        })),
      });

      await this.audit.record(
        {
          operatorId: user.sub,
          operatorType: user.userType,
          operatorName: user.username,
          module: 'notification',
          action: 'notification:send',
          targetType: 'notification',
          after: { targetType: dto.targetType, receiverType, receiverIds, count, type, level, title: dto.title },
          ip,
          userAgent: ua,
        },
        tx,
      );

      return { count, receiverType, receiverIds, type, level, title: dto.title };
    });
  }
}
