import { Injectable } from '@nestjs/common';
import { BizException, ReasonCode } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload';
import { UserJwtPayload } from '../auth/user-jwt-payload';

const MERCHANT_TABS = ['workbench', 'verify', 'notification', 'profile'] as const;
const MEMBER_TABS = ['home', 'wallet', 'mall', 'profile'] as const;

export interface MiniProfile {
  name: string;
  avatar: string | null;
  phone?: string | null;
}

export interface MiniBootstrap {
  role: 'merchant' | 'member';
  profile: MiniProfile;
  merchant: { id: number; name: string; storeId: number | null } | null;
  tabs: readonly string[];
}

@Injectable()
export class MiniService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrap(user: UserJwtPayload | JwtPayload): Promise<MiniBootstrap> {
    if (this.isUser(user)) return this.bootstrapUser(user);
    return this.bootstrapAdmin(user);
  }

  private isUser(user: UserJwtPayload | JwtPayload): user is UserJwtPayload {
    return (user as UserJwtPayload).kind === 'USER';
  }

  private async bootstrapUser(user: UserJwtPayload): Promise<MiniBootstrap> {
    const account = await this.prisma.user.findUnique({ where: { id: user.userId } });
    if (!account || account.status !== 'ACTIVE') {
      throw BizException.unauthorized(ReasonCode.ACCOUNT_DISABLED, '用户不存在或已停用');
    }

    const admin = await this.findMerchantAdmin(account.phone);
    if (admin) {
      return this.merchantBody(admin, {
        name: account.nickname || admin.realName || '微信用户',
        avatar: account.avatar,
      });
    }

    return {
      role: 'member',
      profile: {
        name: account.nickname || '微信用户',
        avatar: account.avatar,
        phone: account.phone,
      },
      merchant: null,
      tabs: MEMBER_TABS,
    };
  }

  private async bootstrapAdmin(user: JwtPayload): Promise<MiniBootstrap> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: user.sub },
      include: { merchant: { select: { id: true, name: true, status: true } } },
    });
    if (!admin || admin.status !== 'ACTIVE') {
      throw BizException.unauthorized(ReasonCode.ACCOUNT_DISABLED, '账号不存在或已停用');
    }
    if (admin.merchantId && admin.merchant?.status === 'APPROVED') {
      return this.merchantBody(admin, {
        name: admin.realName || admin.username,
        avatar: null,
      });
    }

    return {
      role: 'member',
      profile: {
        name: admin.realName || admin.username,
        avatar: null,
        phone: admin.phone,
      },
      merchant: null,
      tabs: MEMBER_TABS,
    };
  }

  /** 手机号与后台账号一致、且后台账号挂了已通过商家时，C 端用户按商家进入。 */
  private findMerchantAdmin(phone: string | null | undefined) {
    if (!phone || phone.startsWith('wx_')) return Promise.resolve(null);
    return this.prisma.adminUser.findFirst({
      where: {
        phone,
        status: 'ACTIVE',
        merchantId: { not: null },
        merchant: { status: 'APPROVED' },
      },
      include: { merchant: { select: { id: true, name: true, status: true } } },
    });
  }

  async workbench(user: UserJwtPayload | JwtPayload) {
    const actor = await this.requireMerchant(user);
    const { start, end } = this.dayRange(0);
    const whereMerchant = actor.merchantIds ? { merchantId: { in: actor.merchantIds } } : {};
    const whereStore = actor.storeId ? { storeId: actor.storeId } : {};
    const [redemptions, pointAgg] = await Promise.all([
      this.prisma.redemptionRecord.count({
        where: { status: 'SUCCESS', redeemedAt: { gte: start, lt: end }, ...whereMerchant, ...whereStore },
      }),
      this.prisma.pointTransaction.aggregate({
        where: { type: 'EARN', createdAt: { gte: start, lt: end }, ...whereMerchant, ...whereStore },
        _sum: { amount: true },
      }),
    ]);
    return {
      greeting: this.greeting(),
      bossName: this.bossName(actor.displayName),
      storeName: actor.placeName,
      storeId: actor.defaultStoreId,
      merchantId: actor.merchantId,
      merchantName: actor.merchantName,
      today: {
        redemptions,
        pointsIssued: Math.abs(Number(pointAgg._sum.amount ?? 0)),
      },
    };
  }

  /**
   * 小Z 还没有可调用的财务诊断接口。
   * 这里用商盟近 30 天订单实收和核销让利算出健康分：
   * 现金支撑月数 = 实收 / 让利（没有让利时不估算）。
   * 近 30 天没有订单则 has_data=false。
   */
  async financeCheckup(user: UserJwtPayload | JwtPayload) {
    const actor = await this.requireMerchant(user);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const whereMerchant = actor.merchantIds ? { merchantId: { in: actor.merchantIds } } : {};
    const whereStore = actor.storeId ? { storeId: actor.storeId } : {};
    const [orders, redemptions] = await Promise.all([
      this.prisma.order.aggregate({
        where: { status: 'NORMAL', consumeTime: { gte: since }, ...whereMerchant, ...whereStore },
        _sum: { payAmount: true },
        _count: { _all: true },
      }),
      this.prisma.redemptionRecord.aggregate({
        where: { status: 'SUCCESS', redeemedAt: { gte: since }, ...whereMerchant, ...whereStore },
        _sum: { discountAmount: true },
        _count: { _all: true },
      }),
    ]);
    const pay = Number(orders._sum.payAmount ?? 0);
    const orderCount = orders._count._all;
    if (orderCount <= 0 && pay <= 0) {
      return { bound: false, has_data: false, score: null, cash_months: null };
    }
    const discount = Number(redemptions._sum.discountAmount ?? 0);
    const volume = Math.min(pay / 1000, 1) * 40;
    const frequency = Math.min(orderCount / 10, 1) * 30;
    const margin = discount <= 0 ? 30 : Math.max(0, Math.min(1, (pay - discount) / Math.max(pay, 1))) * 30;
    const score = Math.max(0, Math.min(100, Math.round(volume + frequency + margin)));
    const cashMonths = discount > 0 ? Math.round((pay / discount) * 10) / 10 : null;
    return { bound: true, has_data: true, score, cash_months: cashMonths };
  }

  private async requireMerchant(user: UserJwtPayload | JwtPayload) {
    const admin = this.isUser(user)
      ? await this.findMerchantAdmin((await this.prisma.user.findUnique({ where: { id: user.userId }, select: { phone: true } }))?.phone)
      : await this.prisma.adminUser.findUnique({
          where: { id: user.sub },
          include: { merchant: { select: { id: true, name: true, status: true, type: true } } },
        });
    if (!admin?.merchantId || !admin.merchant || admin.merchant.status !== 'APPROVED') {
      throw BizException.forbidden(ReasonCode.FORBIDDEN_SCOPE, '当前账号不是商家');
    }
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: admin.merchantId },
      select: { id: true, name: true, type: true },
    });
    let merchantIds: number[] | null = [admin.merchantId];
    if (merchant?.type === 'MAIN') {
      const children = await this.prisma.merchant.findMany({
        where: { parentId: admin.merchantId },
        select: { id: true },
      });
      merchantIds = [admin.merchantId, ...children.map((row) => row.id)];
    }
    const storeId = admin.storeId;
    const place = storeId
      ? await this.prisma.store.findUnique({ where: { id: storeId }, select: { id: true, name: true } })
      : null;
    const fallbackStore = place
      ? place
      : await this.prisma.store.findFirst({
          where: { merchantId: { in: merchantIds }, status: 'OPEN' },
          orderBy: { id: 'asc' },
          select: { id: true, name: true },
        });
    return {
      displayName: admin.realName || admin.username,
      merchantId: admin.merchantId,
      merchantName: merchant?.name || admin.merchant.name,
      merchantIds: storeId ? [admin.merchantId] : merchantIds,
      storeId,
      placeName: place?.name || merchant?.name || '当前商家',
      defaultStoreId: place?.id ?? fallbackStore?.id ?? null,
    };
  }

  private greeting() {
    const hour = Number(
      new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Shanghai' }).format(new Date()),
    );
    if (hour < 11) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  }

  private bossName(name: string) {
    const surname = name.trim().charAt(0);
    return surname ? `${surname}老板` : '老板';
  }

  private dayRange(offset: number) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const start = new Date(Date.UTC(pick('year'), pick('month') - 1, pick('day') + offset, -8, 0, 0, 0));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
  }

  private merchantBody(
    admin: { merchantId: number | null; storeId: number | null; merchant: { id: number; name: string } | null },
    profile: MiniProfile,
  ): MiniBootstrap {
    return {
      role: 'merchant',
      profile,
      merchant: {
        id: admin.merchant?.id ?? admin.merchantId ?? 0,
        name: admin.merchant?.name ?? '',
        storeId: admin.storeId,
      },
      tabs: MERCHANT_TABS,
    };
  }
}
