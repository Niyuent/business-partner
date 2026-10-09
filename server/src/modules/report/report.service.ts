import { Injectable, Logger } from '@nestjs/common';
import { MerchantType, Prisma } from '@prisma/client';
import { toCsv } from '../../common/utils/csv.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload';
import { ReportKey, ReportQueryDto, TrendQueryDto } from './dto/report.dto';

/**
 * 报表中心 + 工作台（S4.3）
 *
 * 性能约定：**所有汇总一律走数据库聚合**（`aggregate` / `groupBy` / `$queryRaw` 分组），
 * 不在应用层循环累加。实测 10000 条订单下各报表均在 1 秒内返回（见 docs/06 S4.3 节）。
 *
 * 隔离约定：平台 / 主体看全平台；附属商家只看自己；店员只看本店。
 */
@Injectable()
export class ReportService {
  private readonly logger = new Logger('Report');

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- 可见范围

  /** 数据可见范围：平台/主体=全平台；附属=本商家；店员=本店 */
  private async scope(user: JwtPayload): Promise<{ merchantId: number | null; storeId: number | null }> {
    if (user.userType === 'PLATFORM') return { merchantId: null, storeId: null };
    if (user.userType === 'STORE') return { merchantId: user.merchantId ?? null, storeId: user.storeId ?? null };
    const me = await this.prisma.merchant.findUnique({
      where: { id: user.merchantId ?? -1 },
      select: { type: true },
    });
    if (me?.type === MerchantType.MAIN) return { merchantId: null, storeId: null };
    return { merchantId: user.merchantId ?? null, storeId: null };
  }

  private range(dto: Pick<ReportQueryDto, 'from' | 'to'>) {
    return {
      ...(dto.from ? { gte: new Date(dto.from) } : {}),
      ...(dto.to ? { lte: new Date(dto.to) } : {}),
    };
  }

  private hasRange(dto: Pick<ReportQueryDto, 'from' | 'to'>) {
    return !!(dto.from || dto.to);
  }

  /** 商家 id → 名称（groupBy 拿不到关联字段，统一用一次查表补全，避免 N+1） */
  private async merchantNames(ids: number[]) {
    if (!ids.length) return new Map<number, string>();
    const rows = await this.prisma.merchant.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  // ---------------------------------------------------------------- 1. 商户入驻

  async merchantOnboarding(dto: ReportQueryDto, user: JwtPayload) {
    const { merchantId } = await this.scope(user);
    const where: Prisma.MerchantWhereInput = {
      ...(merchantId ? { id: merchantId } : {}),
      ...(this.hasRange(dto) ? { createdAt: this.range(dto) } : {}),
    };

    // 按月新增：DATE_FORMAT 直接返回字符串，避免 DATE() 在 raw 下被转成 Date 引发时区歧义
    const conds: Prisma.Sql[] = [Prisma.sql`1=1`];
    if (merchantId) conds.push(Prisma.sql`AND id = ${merchantId}`);
    if (dto.from) conds.push(Prisma.sql`AND createdAt >= ${new Date(dto.from)}`);
    if (dto.to) conds.push(Prisma.sql`AND createdAt <= ${new Date(dto.to)}`);

    const [byStatus, total, monthly] = await Promise.all([
      this.prisma.merchant.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.merchant.count({ where }),
      this.prisma.$queryRaw<Array<{ ym: string; cnt: bigint }>>(
        Prisma.sql`SELECT DATE_FORMAT(createdAt, '%Y-%m') AS ym, COUNT(*) AS cnt
                   FROM merchants WHERE ${Prisma.join(conds, ' ')}
                   GROUP BY ym ORDER BY ym`,
      ),
    ]);

    const summary: Record<string, number> = { total, PENDING: 0, APPROVED: 0, SUSPENDED: 0, REJECTED: 0 };
    for (const r of byStatus) summary[String(r.status)] = r._count._all;

    return {
      summary,
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      monthly: monthly.map((r) => ({ month: r.ym, count: Number(r.cnt) })),
    };
  }

  // ---------------------------------------------------------------- 2. 全平台订单

  async ordersSummary(dto: ReportQueryDto, user: JwtPayload) {
    const { merchantId, storeId } = await this.scope(user);
    const where: Prisma.OrderWhereInput = {
      ...(merchantId ? { merchantId } : {}),
      ...(storeId ? { storeId } : {}),
      ...(this.hasRange(dto) ? { consumeTime: this.range(dto) } : {}),
    };

    const conds: Prisma.Sql[] = [Prisma.sql`1=1`];
    if (merchantId) conds.push(Prisma.sql`AND merchantId = ${merchantId}`);
    if (storeId) conds.push(Prisma.sql`AND storeId = ${storeId}`);
    if (dto.from) conds.push(Prisma.sql`AND consumeTime >= ${new Date(dto.from)}`);
    if (dto.to) conds.push(Prisma.sql`AND consumeTime <= ${new Date(dto.to)}`);

    const [agg, byStatus, byMerchant, daily] = await Promise.all([
      this.prisma.order.aggregate({
        where,
        _count: true,
        _sum: { totalAmount: true, payAmount: true, discountAmount: true },
      }),
      this.prisma.order.groupBy({ by: ['status'], where, _count: { _all: true }, _sum: { payAmount: true } }),
      this.prisma.order.groupBy({
        by: ['merchantId'],
        where,
        _count: { _all: true },
        _sum: { payAmount: true },
        orderBy: { _sum: { payAmount: 'desc' } },
      }),
      this.prisma.$queryRaw<Array<{ d: string; cnt: bigint; amt: Prisma.Decimal | null }>>(
        Prisma.sql`SELECT DATE_FORMAT(consumeTime, '%Y-%m-%d') AS d, COUNT(*) AS cnt, COALESCE(SUM(payAmount),0) AS amt
                   FROM orders WHERE ${Prisma.join(conds, ' ')}
                   GROUP BY d ORDER BY d`,
      ),
    ]);

    const names = await this.merchantNames(byMerchant.map((r) => r.merchantId));

    return {
      summary: {
        count: agg._count,
        totalAmount: Number(agg._sum.totalAmount ?? 0),
        payAmount: Number(agg._sum.payAmount ?? 0),
        discountAmount: Number(agg._sum.discountAmount ?? 0),
      },
      byStatus: byStatus.map((r) => ({
        status: r.status,
        count: r._count._all,
        payAmount: Number(r._sum.payAmount ?? 0),
      })),
      byMerchant: byMerchant.map((r) => ({
        merchantId: r.merchantId,
        merchantName: names.get(r.merchantId) ?? `#${r.merchantId}`,
        count: r._count._all,
        payAmount: Number(r._sum.payAmount ?? 0),
      })),
      daily: daily.map((r) => ({ date: r.d, count: Number(r.cnt), payAmount: Number(r.amt ?? 0) })),
    };
  }

  // ---------------------------------------------------------------- 3. 代金券汇总

  async couponSummary(dto: ReportQueryDto, user: JwtPayload) {
    const { merchantId } = await this.scope(user);
    const where: Prisma.CouponInstanceWhereInput = {
      ...(merchantId ? { issuerMerchantId: merchantId } : {}),
      ...(this.hasRange(dto) ? { obtainedAt: this.range(dto) } : {}),
    };

    const [byStatus, byTemplate, total] = await Promise.all([
      this.prisma.couponInstance.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.couponInstance.groupBy({ by: ['templateId'], where, _count: { _all: true } }),
      this.prisma.couponInstance.count({ where }),
    ]);

    const tids = byTemplate.map((r) => r.templateId);
    let tplNames = new Map<number, string>();
    if (tids.length) {
      const tpls = await this.prisma.couponTemplate.findMany({
        where: { id: { in: tids } },
        select: { id: true, name: true },
      });
      tplNames = new Map(tpls.map((t) => [t.id, t.name]));
    }
    const usedCount = byStatus.find((r) => String(r.status) === 'USED')?._count._all ?? 0;

    return {
      summary: {
        total,
        used: usedCount,
        unused: byStatus.find((r) => String(r.status) === 'UNUSED')?._count._all ?? 0,
        frozen: byStatus.find((r) => String(r.status) === 'FROZEN')?._count._all ?? 0,
        expired: byStatus.find((r) => String(r.status) === 'EXPIRED')?._count._all ?? 0,
        usedRate: total ? Number(((usedCount / total) * 100).toFixed(2)) : 0,
      },
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      byTemplate: byTemplate.map((r) => ({
        templateId: r.templateId,
        templateName: tplNames.get(r.templateId) ?? `#${r.templateId}`,
        count: r._count._all,
      })),
    };
  }

  // ---------------------------------------------------------------- 4. 积分流水

  async pointsSummary(dto: ReportQueryDto, user: JwtPayload) {
    const { merchantId, storeId } = await this.scope(user);
    const where: Prisma.PointTransactionWhereInput = {
      ...(merchantId ? { merchantId } : {}),
      ...(storeId ? { storeId } : {}),
      ...(this.hasRange(dto) ? { createdAt: this.range(dto) } : {}),
    };

    const [byType, agg] = await Promise.all([
      this.prisma.pointTransaction.groupBy({ by: ['type'], where, _count: { _all: true }, _sum: { amount: true } }),
      this.prisma.pointTransaction.aggregate({ where, _count: true, _sum: { amount: true } }),
    ]);

    const pick = (t: string) => byType.find((r) => String(r.type) === t)?._sum.amount ?? 0;

    return {
      summary: {
        count: agg._count,
        net: Number(agg._sum.amount ?? 0),
        earned: Number(pick('EARN')),
        spent: Number(pick('SPEND')),
        expired: Number(pick('EXPIRE')),
        refunded: Number(pick('REFUND')),
        adjusted: Number(pick('ADJUST')),
      },
      byType: byType.map((r) => ({
        type: r.type,
        count: r._count._all,
        amount: Number(r._sum.amount ?? 0),
      })),
    };
  }

  // ---------------------------------------------------------------- 5. 采购核销对账

  async storeSettlement(dto: ReportQueryDto, user: JwtPayload) {
    const { merchantId, storeId } = await this.scope(user);
    const purchaseWhere: Prisma.PurchaseRecordWhereInput = {
      ...(merchantId ? { subMerchantId: merchantId } : {}),
      ...(this.hasRange(dto) ? { purchasedAt: this.range(dto) } : {}),
    };
    const redemptionWhere: Prisma.RedemptionRecordWhereInput = {
      ...(merchantId ? { merchantId } : {}),
      ...(storeId ? { storeId } : {}),
      status: 'SUCCESS',
      ...(this.hasRange(dto) ? { redeemedAt: this.range(dto) } : {}),
    };

    const [pAgg, pBySub, pBySettle, rAgg, rByMerchant] = await Promise.all([
      this.prisma.purchaseRecord.aggregate({ where: purchaseWhere, _count: true, _sum: { totalAmount: true } }),
      this.prisma.purchaseRecord.groupBy({
        by: ['subMerchantId'],
        where: purchaseWhere,
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.purchaseRecord.groupBy({
        by: ['settleStatus'],
        where: purchaseWhere,
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.redemptionRecord.aggregate({
        where: redemptionWhere,
        _count: true,
        _sum: { faceValue: true },
      }),
      this.prisma.redemptionRecord.groupBy({
        by: ['merchantId'],
        where: redemptionWhere,
        _count: { _all: true },
        _sum: { faceValue: true },
      }),
    ]);

    // 按商家合并「采购额 vs 核销额」，差额即待与商家结算的口径
    const merged = new Map<number, { purchaseAmount: number; purchaseCount: number; redemptionAmount: number; redemptionCount: number }>();
    for (const p of pBySub) {
      merged.set(p.subMerchantId, {
        purchaseAmount: Number(p._sum.totalAmount ?? 0),
        purchaseCount: p._count._all,
        redemptionAmount: 0,
        redemptionCount: 0,
      });
    }
    for (const r of rByMerchant) {
      const cur = merged.get(r.merchantId) ?? {
        purchaseAmount: 0,
        purchaseCount: 0,
        redemptionAmount: 0,
        redemptionCount: 0,
      };
      cur.redemptionAmount = Number(r._sum.faceValue ?? 0);
      cur.redemptionCount = r._count._all;
      merged.set(r.merchantId, cur);
    }
    const names = await this.merchantNames([...merged.keys()]);

    return {
      summary: {
        purchaseCount: pAgg._count,
        purchaseAmount: Number(pAgg._sum.totalAmount ?? 0),
        redemptionCount: rAgg._count,
        redemptionAmount: Number(rAgg._sum.faceValue ?? 0),
      },
      bySettleStatus: pBySettle.map((r) => ({
        settleStatus: r.settleStatus,
        count: r._count._all,
        totalAmount: Number(r._sum.totalAmount ?? 0),
      })),
      byMerchant: [...merged.entries()].map(([id, v]) => ({
        merchantId: id,
        merchantName: names.get(id) ?? `#${id}`,
        ...v,
        diffAmount: Number((v.purchaseAmount - v.redemptionAmount).toFixed(2)),
      })),
    };
  }

  // ---------------------------------------------------------------- 6. 授权记录

  async authorizationLogs(dto: ReportQueryDto, user: JwtPayload) {
    const { merchantId } = await this.scope(user);
    const where: Prisma.MerchantAuthorizationWhereInput = {
      ...(merchantId ? { OR: [{ mainMerchantId: merchantId }, { subMerchantId: merchantId }] } : {}),
      ...(this.hasRange(dto) ? { grantedAt: this.range(dto) } : {}),
    };

    const [rows, total, byStatus] = await Promise.all([
      this.prisma.merchantAuthorization.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (dto.page - 1) * dto.pageSize,
        take: dto.pageSize,
        include: { templates: { select: { templateId: true } } },
      }),
      this.prisma.merchantAuthorization.count({ where }),
      this.prisma.merchantAuthorization.groupBy({ by: ['status'], where, _count: { _all: true } }),
    ]);

    const ids = [...new Set(rows.flatMap((r) => [r.mainMerchantId, r.subMerchantId]))];
    const names = await this.merchantNames(ids);
    const tids = [...new Set(rows.flatMap((r) => r.templates.map((t) => t.templateId)))];
    let tplNames = new Map<number, string>();
    if (tids.length) {
      const tpls = await this.prisma.couponTemplate.findMany({
        where: { id: { in: tids } },
        select: { id: true, name: true },
      });
      tplNames = new Map(tpls.map((t) => [t.id, t.name]));
    }

    return {
      total,
      page: dto.page,
      pageSize: dto.pageSize,
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      list: rows.map((r) => ({
        id: r.id,
        mainMerchantId: r.mainMerchantId,
        mainMerchantName: names.get(r.mainMerchantId) ?? `#${r.mainMerchantId}`,
        subMerchantId: r.subMerchantId,
        subMerchantName: names.get(r.subMerchantId) ?? `#${r.subMerchantId}`,
        status: r.status,
        templateScope: r.templateScope,
        templateNames: r.templates.map((t) => tplNames.get(t.templateId) ?? `#${t.templateId}`),
        grantedAt: r.grantedAt,
        revokedAt: r.revokedAt,
        revokeReason: r.revokeReason,
      })),
    };
  }

  // ---------------------------------------------------------------- 导出（统一 CSV）

  async exportCsv(key: ReportKey, dto: ReportQueryDto, user: JwtPayload): Promise<string> {
    switch (key) {
      case 'merchant-onboarding': {
        const r = await this.merchantOnboarding(dto, user);
        return toCsv(
          ['月份', '新增商家数'],
          r.monthly.map((m) => [m.month, m.count]),
        );
      }
      case 'orders-summary': {
        const r = await this.ordersSummary(dto, user);
        return toCsv(
          ['商家', '订单数', '实付金额'],
          r.byMerchant.map((m) => [m.merchantName, m.count, m.payAmount]),
        );
      }
      case 'coupon-summary': {
        const r = await this.couponSummary(dto, user);
        return toCsv(
          ['券模板', '发放张数'],
          r.byTemplate.map((t) => [t.templateName, t.count]),
        );
      }
      case 'points-summary': {
        const r = await this.pointsSummary(dto, user);
        return toCsv(
          ['流水类型', '笔数', '积分变动'],
          r.byType.map((t) => [t.type, t.count, t.amount]),
        );
      }
      case 'store-settlement': {
        const r = await this.storeSettlement(dto, user);
        return toCsv(
          ['商家', '采购笔数', '采购金额', '核销笔数', '核销金额', '差额'],
          r.byMerchant.map((m) => [
            m.merchantName,
            m.purchaseCount,
            m.purchaseAmount,
            m.redemptionCount,
            m.redemptionAmount,
            m.diffAmount,
          ]),
        );
      }
      case 'authorization-logs': {
        const r = await this.authorizationLogs({ ...dto, pageSize: 200 }, user);
        return toCsv(
          ['授权id', '主体商家', '附属商家', '状态', '范围', '券模板', '授权时间', '撤销时间', '撤销原因'],
          r.list.map((a) => [
            a.id,
            a.mainMerchantName,
            a.subMerchantName,
            a.status,
            a.templateScope,
            a.templateNames.join(' / '),
            a.grantedAt,
            a.revokedAt ?? '',
            a.revokeReason ?? '',
          ]),
        );
      }
      default:
        return toCsv(['错误'], [[`未知的报表 key：${key}`]]);
    }
  }

  // ---------------------------------------------------------------- 工作台

  /** 本地日期 YYYY-MM-DD（与 MySQL DATE_FORMAT 的会话时区口径保持一致） */
  private ymd(d: Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  private async statsCards(user: JwtPayload) {
    const { merchantId, storeId } = await this.scope(user);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const orderWhere: Prisma.OrderWhereInput = {
      ...(merchantId ? { merchantId } : {}),
      ...(storeId ? { storeId } : {}),
    };
    const redeemWhere: Prisma.RedemptionRecordWhereInput = {
      ...(merchantId ? { merchantId } : {}),
      ...(storeId ? { storeId } : {}),
      status: 'SUCCESS',
    };
    const couponWhere: Prisma.CouponInstanceWhereInput = {
      ...(merchantId ? { issuerMerchantId: merchantId } : {}),
    };

    const win = (w: Record<string, unknown>, from: Date, to: Date) => ({ ...w, createdAt: { gte: from, lt: to } });
    const redeemWin = (from: Date, to: Date) => ({ ...redeemWhere, redeemedAt: { gte: from, lt: to } });

    const [
      ordersToday, ordersYest,
      redeemToday, redeemYest,
      exchangeToday, exchangeYest,
      couponToday, couponYest,
    ] = await Promise.all([
      this.prisma.order.count({ where: win(orderWhere, today, tomorrow) }),
      this.prisma.order.count({ where: win(orderWhere, yesterday, today) }),
      this.prisma.redemptionRecord.count({ where: redeemWin(today, tomorrow) }),
      this.prisma.redemptionRecord.count({ where: redeemWin(yesterday, today) }),
      this.prisma.exchangeRecord.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      this.prisma.exchangeRecord.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
      this.prisma.couponInstance.count({ where: win(couponWhere, today, tomorrow) }),
      this.prisma.couponInstance.count({ where: win(couponWhere, yesterday, today) }),
    ]);

    /** 环比：昨日为 0 时给 100%（从无到有），否则按百分比 */
    const trend = (today_: number, yest: number) =>
      yest === 0 ? (today_ === 0 ? 0 : 100) : Number((((today_ - yest) / yest) * 100).toFixed(1));

    return [
      { key: 'orders', label: '今日订单', value: ordersToday, unit: '单', trend: trend(ordersToday, ordersYest) },
      { key: 'redemptions', label: '今日核销', value: redeemToday, unit: '笔', trend: trend(redeemToday, redeemYest) },
      { key: 'exchanges', label: '今日兑换', value: exchangeToday, unit: '笔', trend: trend(exchangeToday, exchangeYest) },
      { key: 'coupons', label: '今日发券', value: couponToday, unit: '张', trend: trend(couponToday, couponYest) },
    ];
  }

  async stats(user: JwtPayload) {
    const [cards, todo] = await Promise.all([this.statsCards(user), this.todo(user)]);
    return { cards, todo };
  }

  async todo(user: JwtPayload) {
    const { merchantId } = await this.scope(user);
    const pendingWhere: Prisma.MerchantWhereInput = {
      status: 'PENDING',
      ...(merchantId ? { id: merchantId } : {}),
    };
    const abnormalWhere: Prisma.OrderWhereInput = {
      status: 'ABNORMAL',
      ...(merchantId ? { merchantId } : {}),
    };

    // 通知是多态接收方（receiverType + receiverId）：把「商家 id」和「账号 id」都算进去，
    // 避免 seed 口径不一致时待办数恒为 0
    const receivers = [merchantId, user.sub].filter((v): v is number => typeof v === 'number');
    const unreadWhere: Prisma.NotificationWhereInput = { readStatus: 'UNREAD' };
    if (receivers.length) unreadWhere.receiverId = { in: receivers };

    const [pendingMerchants, abnormalOrders, unreadNotifications] = await Promise.all([
      this.prisma.merchant.count({ where: pendingWhere }),
      this.prisma.order.count({ where: abnormalWhere }),
      this.prisma.notification.count({ where: unreadWhere }),
    ]);

    return { pendingMerchants, abnormalOrders, unreadNotifications };
  }

  /** 近 N 天趋势：订单 / 核销 / 兑换（三条线，DB 分组聚合后前端补齐空日期） */
  async trend(dto: TrendQueryDto, user: JwtPayload) {
    const { merchantId, storeId } = await this.scope(user);
    const days = dto.days ?? 7;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(this.ymd(d));
    }
    const from = start;
    const to = new Date(start);
    to.setDate(to.getDate() + days);

    const ordConds: Prisma.Sql[] = [Prisma.sql`createdAt >= ${from} AND createdAt < ${to}`];
    if (merchantId) ordConds.push(Prisma.sql`AND merchantId = ${merchantId}`);
    if (storeId) ordConds.push(Prisma.sql`AND storeId = ${storeId}`);

    const redConds: Prisma.Sql[] = [Prisma.sql`redeemedAt >= ${from} AND redeemedAt < ${to} AND status = 'SUCCESS'`];
    if (merchantId) redConds.push(Prisma.sql`AND merchantId = ${merchantId}`);
    if (storeId) redConds.push(Prisma.sql`AND storeId = ${storeId}`);

    const [orderRows, redeemRows, exchangeRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ d: string; cnt: bigint }>>(
        Prisma.sql`SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') AS d, COUNT(*) AS cnt
                   FROM orders WHERE ${Prisma.join(ordConds, ' ')} GROUP BY d`,
      ),
      this.prisma.$queryRaw<Array<{ d: string; cnt: bigint }>>(
        Prisma.sql`SELECT DATE_FORMAT(redeemedAt, '%Y-%m-%d') AS d, COUNT(*) AS cnt
                   FROM redemption_records WHERE ${Prisma.join(redConds, ' ')} GROUP BY d`,
      ),
      this.prisma.$queryRaw<Array<{ d: string; cnt: bigint }>>(
        Prisma.sql`SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') AS d, COUNT(*) AS cnt
                   FROM exchange_records WHERE createdAt >= ${from} AND createdAt < ${to} GROUP BY d`,
      ),
    ]);

    const fill = (rows: Array<{ d: string; cnt: bigint }>) => {
      const m = new Map(rows.map((r) => [r.d, Number(r.cnt)]));
      return dates.map((d) => m.get(d) ?? 0);
    };

    return {
      dates,
      orders: fill(orderRows),
      redemptions: fill(redeemRows),
      exchanges: fill(exchangeRows),
    };
  }
}
