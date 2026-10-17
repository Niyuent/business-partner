"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const csv_util_1 = require("../../common/utils/csv.util");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const notification_service_1 = require("../notification/notification.service");
let ReportService = class ReportService {
    constructor(prisma, notifications) {
        this.prisma = prisma;
        this.notifications = notifications;
        this.logger = new common_1.Logger('Report');
    }
    async scope(user) {
        if (user.userType === 'PLATFORM')
            return { merchantId: null, storeId: null };
        if (user.userType === 'STORE')
            return { merchantId: user.merchantId ?? null, storeId: user.storeId ?? null };
        const me = await this.prisma.merchant.findUnique({
            where: { id: user.merchantId ?? -1 },
            select: { type: true },
        });
        if (me?.type === client_1.MerchantType.MAIN)
            return { merchantId: null, storeId: null };
        return { merchantId: user.merchantId ?? null, storeId: null };
    }
    range(dto) {
        return {
            ...(dto.from ? { gte: new Date(dto.from) } : {}),
            ...(dto.to ? { lte: new Date(dto.to) } : {}),
        };
    }
    hasRange(dto) {
        return !!(dto.from || dto.to);
    }
    async merchantNames(ids) {
        if (!ids.length)
            return new Map();
        const rows = await this.prisma.merchant.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
        });
        return new Map(rows.map((r) => [r.id, r.name]));
    }
    async merchantOnboarding(dto, user) {
        const { merchantId } = await this.scope(user);
        const where = {
            ...(merchantId ? { id: merchantId } : {}),
            ...(this.hasRange(dto) ? { createdAt: this.range(dto) } : {}),
        };
        const conds = [client_1.Prisma.sql `1=1`];
        if (merchantId)
            conds.push(client_1.Prisma.sql `AND id = ${merchantId}`);
        if (dto.from)
            conds.push(client_1.Prisma.sql `AND createdAt >= ${new Date(dto.from)}`);
        if (dto.to)
            conds.push(client_1.Prisma.sql `AND createdAt <= ${new Date(dto.to)}`);
        const [byStatus, total, monthly] = await Promise.all([
            this.prisma.merchant.groupBy({ by: ['status'], where, _count: { _all: true } }),
            this.prisma.merchant.count({ where }),
            this.prisma.$queryRaw(client_1.Prisma.sql `SELECT DATE_FORMAT(createdAt, '%Y-%m') AS ym, COUNT(*) AS cnt
                   FROM merchants WHERE ${client_1.Prisma.join(conds, ' ')}
                   GROUP BY ym ORDER BY ym`),
        ]);
        const summary = { total, PENDING: 0, APPROVED: 0, SUSPENDED: 0, REJECTED: 0 };
        for (const r of byStatus)
            summary[String(r.status)] = r._count._all;
        return {
            summary,
            byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
            monthly: monthly.map((r) => ({ month: r.ym, count: Number(r.cnt) })),
        };
    }
    async ordersSummary(dto, user) {
        const { merchantId, storeId } = await this.scope(user);
        const where = {
            ...(merchantId ? { merchantId } : {}),
            ...(storeId ? { storeId } : {}),
            ...(this.hasRange(dto) ? { consumeTime: this.range(dto) } : {}),
        };
        const conds = [client_1.Prisma.sql `1=1`];
        if (merchantId)
            conds.push(client_1.Prisma.sql `AND merchantId = ${merchantId}`);
        if (storeId)
            conds.push(client_1.Prisma.sql `AND storeId = ${storeId}`);
        if (dto.from)
            conds.push(client_1.Prisma.sql `AND consumeTime >= ${new Date(dto.from)}`);
        if (dto.to)
            conds.push(client_1.Prisma.sql `AND consumeTime <= ${new Date(dto.to)}`);
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
            this.prisma.$queryRaw(client_1.Prisma.sql `SELECT DATE_FORMAT(consumeTime, '%Y-%m-%d') AS d, COUNT(*) AS cnt, COALESCE(SUM(payAmount),0) AS amt
                   FROM orders WHERE ${client_1.Prisma.join(conds, ' ')}
                   GROUP BY d ORDER BY d`),
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
    async couponSummary(dto, user) {
        const { merchantId } = await this.scope(user);
        const where = {
            ...(merchantId ? { issuerMerchantId: merchantId } : {}),
            ...(this.hasRange(dto) ? { obtainedAt: this.range(dto) } : {}),
        };
        const [byStatus, byTemplate, total] = await Promise.all([
            this.prisma.couponInstance.groupBy({ by: ['status'], where, _count: { _all: true } }),
            this.prisma.couponInstance.groupBy({ by: ['templateId'], where, _count: { _all: true } }),
            this.prisma.couponInstance.count({ where }),
        ]);
        const tids = byTemplate.map((r) => r.templateId);
        let tplNames = new Map();
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
    async pointsSummary(dto, user) {
        const { merchantId, storeId } = await this.scope(user);
        const where = {
            ...(merchantId ? { merchantId } : {}),
            ...(storeId ? { storeId } : {}),
            ...(this.hasRange(dto) ? { createdAt: this.range(dto) } : {}),
        };
        const [byType, agg] = await Promise.all([
            this.prisma.pointTransaction.groupBy({ by: ['type'], where, _count: { _all: true }, _sum: { amount: true } }),
            this.prisma.pointTransaction.aggregate({ where, _count: true, _sum: { amount: true } }),
        ]);
        const pick = (t) => byType.find((r) => String(r.type) === t)?._sum.amount ?? 0;
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
    async storeSettlement(dto, user) {
        const { merchantId, storeId } = await this.scope(user);
        const purchaseWhere = {
            ...(merchantId ? { subMerchantId: merchantId } : {}),
            ...(this.hasRange(dto) ? { purchasedAt: this.range(dto) } : {}),
        };
        const redemptionWhere = {
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
        const merged = new Map();
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
    async authorizationLogs(dto, user) {
        const { merchantId } = await this.scope(user);
        const where = {
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
        let tplNames = new Map();
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
    async exportCsv(key, dto, user) {
        switch (key) {
            case 'merchant-onboarding': {
                const r = await this.merchantOnboarding(dto, user);
                return (0, csv_util_1.toCsv)(['月份', '新增商家数'], r.monthly.map((m) => [m.month, m.count]));
            }
            case 'orders-summary': {
                const r = await this.ordersSummary(dto, user);
                return (0, csv_util_1.toCsv)(['商家', '订单数', '实付金额'], r.byMerchant.map((m) => [m.merchantName, m.count, m.payAmount]));
            }
            case 'coupon-summary': {
                const r = await this.couponSummary(dto, user);
                return (0, csv_util_1.toCsv)(['券模板', '发放张数'], r.byTemplate.map((t) => [t.templateName, t.count]));
            }
            case 'points-summary': {
                const r = await this.pointsSummary(dto, user);
                return (0, csv_util_1.toCsv)(['流水类型', '笔数', '积分变动'], r.byType.map((t) => [t.type, t.count, t.amount]));
            }
            case 'store-settlement': {
                const r = await this.storeSettlement(dto, user);
                return (0, csv_util_1.toCsv)(['商家', '采购笔数', '采购金额', '核销笔数', '核销金额', '差额'], r.byMerchant.map((m) => [
                    m.merchantName,
                    m.purchaseCount,
                    m.purchaseAmount,
                    m.redemptionCount,
                    m.redemptionAmount,
                    m.diffAmount,
                ]));
            }
            case 'authorization-logs': {
                const r = await this.authorizationLogs({ ...dto, pageSize: 200 }, user);
                return (0, csv_util_1.toCsv)(['授权id', '主体商家', '附属商家', '状态', '范围', '券模板', '授权时间', '撤销时间', '撤销原因'], r.list.map((a) => [
                    a.id,
                    a.mainMerchantName,
                    a.subMerchantName,
                    a.status,
                    a.templateScope,
                    a.templateNames.join(' / '),
                    a.grantedAt,
                    a.revokedAt ?? '',
                    a.revokeReason ?? '',
                ]));
            }
            default:
                return (0, csv_util_1.toCsv)(['错误'], [[`未知的报表 key：${key}`]]);
        }
    }
    ymd(d) {
        const p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
    async statsCards(user) {
        const { merchantId, storeId } = await this.scope(user);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const orderWhere = {
            ...(merchantId ? { merchantId } : {}),
            ...(storeId ? { storeId } : {}),
        };
        const redeemWhere = {
            ...(merchantId ? { merchantId } : {}),
            ...(storeId ? { storeId } : {}),
            status: 'SUCCESS',
        };
        const couponWhere = {
            ...(merchantId ? { issuerMerchantId: merchantId } : {}),
        };
        const win = (w, from, to) => ({ ...w, createdAt: { gte: from, lt: to } });
        const redeemWin = (from, to) => ({ ...redeemWhere, redeemedAt: { gte: from, lt: to } });
        const ptAgg = (type, from, to) => this.prisma.pointTransaction.aggregate({
            where: {
                ...(merchantId ? { merchantId } : {}),
                ...(storeId ? { storeId } : {}),
                type,
                createdAt: { gte: from, lt: to },
            },
            _sum: { amount: true },
        });
        const sumPt = async (type, from, to) => Math.abs(Number((await ptAgg(type, from, to))._sum.amount ?? 0));
        const [ordersToday, ordersYest, redeemToday, redeemYest, exchangeToday, exchangeYest, couponToday, couponYest, pointIssuedToday, pointIssuedYest, pointConsumedToday, pointConsumedYest,] = await Promise.all([
            this.prisma.order.count({ where: win(orderWhere, today, tomorrow) }),
            this.prisma.order.count({ where: win(orderWhere, yesterday, today) }),
            this.prisma.redemptionRecord.count({ where: redeemWin(today, tomorrow) }),
            this.prisma.redemptionRecord.count({ where: redeemWin(yesterday, today) }),
            this.prisma.exchangeRecord.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
            this.prisma.exchangeRecord.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
            this.prisma.couponInstance.count({ where: win(couponWhere, today, tomorrow) }),
            this.prisma.couponInstance.count({ where: win(couponWhere, yesterday, today) }),
            sumPt('EARN', today, tomorrow),
            sumPt('EARN', yesterday, today),
            sumPt('SPEND', today, tomorrow),
            sumPt('SPEND', yesterday, today),
        ]);
        const trend = (today_, yest) => yest === 0 ? (today_ === 0 ? 0 : 100) : Number((((today_ - yest) / yest) * 100).toFixed(1));
        return [
            { key: 'orders', label: '今日订单', value: ordersToday, unit: '单', trend: trend(ordersToday, ordersYest) },
            { key: 'redemptions', label: '今日核销', value: redeemToday, unit: '笔', trend: trend(redeemToday, redeemYest) },
            { key: 'exchanges', label: '今日兑换', value: exchangeToday, unit: '笔', trend: trend(exchangeToday, exchangeYest) },
            { key: 'coupons', label: '今日发券', value: couponToday, unit: '张', trend: trend(couponToday, couponYest) },
            { key: 'pointIssued', label: '今日积分发行', value: pointIssuedToday, unit: '分', trend: trend(pointIssuedToday, pointIssuedYest) },
            { key: 'pointConsumed', label: '今日积分消耗', value: pointConsumedToday, unit: '分', trend: trend(pointConsumedToday, pointConsumedYest) },
        ];
    }
    async stats(user) {
        const [cards, todo] = await Promise.all([this.statsCards(user), this.todo(user)]);
        return { cards, todo };
    }
    async todo(user) {
        const { merchantId } = await this.scope(user);
        const pendingWhere = {
            status: 'PENDING',
            ...(merchantId ? { id: merchantId } : {}),
        };
        const abnormalWhere = {
            status: 'ABNORMAL',
            ...(merchantId ? { merchantId } : {}),
        };
        const [pendingMerchants, abnormalOrders, unreadNotifications] = await Promise.all([
            this.prisma.merchant.count({ where: pendingWhere }),
            this.prisma.order.count({ where: abnormalWhere }),
            this.notifications.getUnreadCount(user),
        ]);
        return { pendingMerchants, abnormalOrders, unreadNotifications };
    }
    async trend(dto, user) {
        const { merchantId, storeId } = await this.scope(user);
        const days = dto.days ?? 7;
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - (days - 1));
        const dates = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            dates.push(this.ymd(d));
        }
        const from = start;
        const to = new Date(start);
        to.setDate(to.getDate() + days);
        const ordConds = [client_1.Prisma.sql `createdAt >= ${from} AND createdAt < ${to}`];
        if (merchantId)
            ordConds.push(client_1.Prisma.sql `AND merchantId = ${merchantId}`);
        if (storeId)
            ordConds.push(client_1.Prisma.sql `AND storeId = ${storeId}`);
        const redConds = [client_1.Prisma.sql `redeemedAt >= ${from} AND redeemedAt < ${to} AND status = 'SUCCESS'`];
        if (merchantId)
            redConds.push(client_1.Prisma.sql `AND merchantId = ${merchantId}`);
        if (storeId)
            redConds.push(client_1.Prisma.sql `AND storeId = ${storeId}`);
        const [orderRows, redeemRows, exchangeRows] = await Promise.all([
            this.prisma.$queryRaw(client_1.Prisma.sql `SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') AS d, COUNT(*) AS cnt
                   FROM orders WHERE ${client_1.Prisma.join(ordConds, ' ')} GROUP BY d`),
            this.prisma.$queryRaw(client_1.Prisma.sql `SELECT DATE_FORMAT(redeemedAt, '%Y-%m-%d') AS d, COUNT(*) AS cnt
                   FROM redemption_records WHERE ${client_1.Prisma.join(redConds, ' ')} GROUP BY d`),
            this.prisma.$queryRaw(client_1.Prisma.sql `SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') AS d, COUNT(*) AS cnt
                   FROM exchange_records WHERE createdAt >= ${from} AND createdAt < ${to} GROUP BY d`),
        ]);
        const fill = (rows) => {
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
    async distribution(user) {
        const { merchantId, storeId } = await this.scope(user);
        const couponWhere = {
            ...(merchantId ? { issuerMerchantId: merchantId } : {}),
        };
        const ptWhere = {
            ...(merchantId ? { merchantId } : {}),
            ...(storeId ? { storeId } : {}),
        };
        const [couponRows, ptRows] = await Promise.all([
            this.prisma.couponInstance.groupBy({ by: ['templateId'], where: couponWhere, _count: { _all: true } }),
            this.prisma.pointTransaction.groupBy({ by: ['type'], where: ptWhere, _sum: { amount: true } }),
        ]);
        const templateIds = couponRows.map((r) => r.templateId);
        const templates = templateIds.length
            ? await this.prisma.couponTemplate.findMany({
                where: { id: { in: templateIds } },
                select: { id: true, ownerType: true },
            })
            : [];
        const ownerTypeOf = new Map(templates.map((t) => [t.id, t.ownerType]));
        const couponCount = new Map();
        for (const r of couponRows) {
            const ot = ownerTypeOf.get(r.templateId) ?? 'UNKNOWN';
            couponCount.set(ot, (couponCount.get(ot) ?? 0) + r._count._all);
        }
        const couponTypes = Array.from(couponCount.entries()).map(([type, count]) => ({ type, count }));
        const pointSources = ptRows.map((r) => ({
            type: r.type,
            value: Math.abs(Number(r._sum.amount ?? 0)),
        }));
        return { couponTypes, pointSources };
    }
    async topMerchants(user) {
        const { merchantId } = await this.scope(user);
        if (merchantId)
            return [];
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `SELECT o.merchantId, m.name, SUM(o.payAmount) AS amount
                 FROM orders o JOIN merchants m ON m.id = o.merchantId
                 GROUP BY o.merchantId, m.name
                 ORDER BY amount DESC
                 LIMIT 5`);
        return rows.map((r) => ({
            merchantId: Number(r.merchantId),
            name: String(r.name),
            amount: Number(r.amount),
        }));
    }
    async galaxy(user) {
        const { merchantId } = await this.scope(user);
        if (merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '星系视图仅主体/平台可用');
        }
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const isPlatform = user.userType === 'PLATFORM';
        const centerMerchant = isPlatform
            ? null
            : await this.prisma.merchant.findUnique({
                where: { id: user.merchantId ?? -1 },
                select: { id: true, name: true, status: true },
            });
        const centerId = centerMerchant?.id ?? 0;
        const planets = await this.prisma.merchant.findMany({
            where: isPlatform ? { type: client_1.MerchantType.SUB } : { parentId: centerId || -1 },
            select: { id: true, name: true, code: true, status: true },
            orderBy: { id: 'asc' },
        });
        const rows = await this.prisma.order.groupBy({
            by: ['merchantId'],
            where: {
                consumeTime: { gte: monthStart },
                merchantId: { in: planets.length ? planets.map((p) => p.id) : [-1] },
            },
            _sum: { payAmount: true },
            _count: { _all: true },
        });
        const agg = new Map(rows.map((r) => [r.merchantId, { amount: Number(r._sum.payAmount ?? 0), count: r._count._all }]));
        const centerScope = isPlatform ? {} : { merchantId: { in: [centerId, ...planets.map((p) => p.id)] } };
        const [centerMonth, centerToday] = await Promise.all([
            this.prisma.order.aggregate({
                where: { consumeTime: { gte: monthStart }, ...centerScope },
                _sum: { payAmount: true },
                _count: { _all: true },
            }),
            this.prisma.order.aggregate({
                where: { consumeTime: { gte: dayStart }, ...centerScope },
                _sum: { payAmount: true },
            }),
        ]);
        return {
            center: {
                id: centerId,
                name: centerMerchant?.name ?? '平台',
                type: isPlatform ? 'PLATFORM' : 'MAIN',
                status: centerMerchant?.status ?? null,
                monthAmount: Number(centerMonth._sum.payAmount ?? 0),
                todayAmount: Number(centerToday._sum.payAmount ?? 0),
                monthOrderCount: centerMonth._count._all,
                planetCount: planets.length,
            },
            planets: planets.map((p) => ({
                id: p.id,
                name: p.name,
                code: p.code,
                status: p.status,
                monthAmount: agg.get(p.id)?.amount ?? 0,
                orderCount: agg.get(p.id)?.count ?? 0,
            })),
            flows: planets.map((p) => ({ source: centerId, target: p.id, value: agg.get(p.id)?.amount ?? 0 })),
        };
    }
};
exports.ReportService = ReportService;
exports.ReportService = ReportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService])
], ReportService);
//# sourceMappingURL=report.service.js.map