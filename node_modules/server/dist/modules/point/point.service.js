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
exports.PointService = exports.ConcurrentSignal = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const audit_service_1 = require("../audit-log/audit.service");
const ACTION = {
    earn: 'point:earn',
    adjust: 'point:adjust',
    exchange: 'point:exchange',
    ruleUpdate: 'point:rule:update',
    expire: 'POINTS_EXPIRE',
};
const MAX_RETRY = 3;
const EXPIRING_SOON_DAYS = 30;
const BATCH_TYPES = [client_1.PointTxnType.EARN, client_1.PointTxnType.ADJUST, client_1.PointTxnType.REFUND];
class ConcurrentSignal extends Error {
    constructor() {
        super('CONCURRENT_ACCOUNT_UPDATE');
    }
}
exports.ConcurrentSignal = ConcurrentSignal;
let PointService = class PointService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
        this.logger = new common_1.Logger('Point');
        this.running = false;
    }
    async listAccounts(query, user) {
        const scope = await this.scopeFilter(user);
        let visibleUserIds = null;
        if (Object.keys(scope).length > 0) {
            const rows = await this.prisma.pointTransaction.findMany({
                where: scope,
                distinct: ['userId'],
                select: { userId: true },
            });
            visibleUserIds = rows.map((r) => r.userId);
        }
        const userFilter = query.keyword
            ? { OR: [{ nickname: { contains: query.keyword } }, { phone: { contains: query.keyword } }] }
            : {};
        const where = {
            ...(visibleUserIds ? { userId: { in: visibleUserIds } } : {}),
            ...(query.minBalance !== undefined ? { balance: { gte: query.minBalance } } : {}),
            ...(query.keyword ? { user: userFilter } : {}),
        };
        const [rows, total] = await Promise.all([
            this.prisma.pointAccount.findMany({
                where,
                orderBy: [{ balance: 'desc' }, { id: 'desc' }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
                include: { user: { select: { id: true, nickname: true, phone: true, status: true } } },
            }),
            this.prisma.pointAccount.count({ where }),
        ]);
        const now = new Date();
        const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 3600 * 1000);
        const expiring = await this.prisma.pointTransaction.groupBy({
            by: ['userId'],
            where: {
                userId: { in: rows.map((r) => r.userId) },
                remainingAmount: { gt: 0 },
                expireAt: { gt: now, lte: soon },
            },
            _sum: { remainingAmount: true },
        });
        const expiringMap = new Map(expiring.map((e) => [e.userId, e._sum.remainingAmount ?? 0]));
        let list = rows.map((r) => ({
            id: r.id,
            userId: r.userId,
            userName: r.user?.nickname ?? null,
            userPhone: r.user?.phone ?? null,
            balance: r.balance,
            totalEarned: r.totalEarned,
            totalSpent: r.totalSpent,
            totalExpired: r.totalExpired,
            expiringSoon: expiringMap.get(r.userId) ?? 0,
            version: r.version,
            updatedAt: r.updatedAt,
        }));
        if (query.expiringSoon)
            list = list.filter((x) => x.expiringSoon > 0);
        return { list, total: query.expiringSoon ? list.length : total, page: query.page, pageSize: query.pageSize };
    }
    async accountDetail(userId, user) {
        await this.assertUserVisible(userId, user);
        const account = await this.prisma.pointAccount.findUnique({
            where: { userId },
            include: { user: { select: { id: true, nickname: true, phone: true, status: true } } },
        });
        if (!account) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.POINT_ACCOUNT_NOT_FOUND, `用户 #${userId} 还没有积分账户`);
        }
        const now = new Date();
        const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 3600 * 1000);
        const batches = await this.prisma.pointTransaction.findMany({
            where: { userId, remainingAmount: { gt: 0 } },
            orderBy: [{ expireAt: 'asc' }, { id: 'asc' }],
            select: {
                id: true,
                type: true,
                amount: true,
                remainingAmount: true,
                expireAt: true,
                merchantId: true,
                storeId: true,
                createdAt: true,
                remark: true,
            },
        });
        const merchantIds = [...new Set(batches.map((b) => b.merchantId).filter((v) => !!v))];
        const merchants = merchantIds.length
            ? await this.prisma.merchant.findMany({ where: { id: { in: merchantIds } }, select: { id: true, name: true } })
            : [];
        const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));
        const alive = batches.filter((b) => !b.expireAt || b.expireAt > now);
        const expired = batches.filter((b) => b.expireAt && b.expireAt <= now);
        return {
            account: {
                id: account.id,
                userId: account.userId,
                userName: account.user?.nickname ?? null,
                userPhone: account.user?.phone ?? null,
                balance: account.balance,
                totalEarned: account.totalEarned,
                totalSpent: account.totalSpent,
                totalExpired: account.totalExpired,
                version: account.version,
                updatedAt: account.updatedAt,
            },
            summary: {
                available: alive.reduce((s, b) => s + b.remainingAmount, 0),
                expiringSoon: alive
                    .filter((b) => b.expireAt && b.expireAt <= soon)
                    .reduce((s, b) => s + b.remainingAmount, 0),
                expiredPending: expired.reduce((s, b) => s + b.remainingAmount, 0),
                batchCount: alive.length,
            },
            batches: batches.map((b) => ({
                id: b.id,
                type: b.type,
                amount: b.amount,
                remainingAmount: b.remainingAmount,
                expireAt: b.expireAt,
                usable: !b.expireAt || b.expireAt > now,
                merchantId: b.merchantId,
                merchantName: b.merchantId ? merchantMap.get(b.merchantId) ?? null : null,
                storeId: b.storeId,
                createdAt: b.createdAt,
                remark: b.remark,
            })),
        };
    }
    async listTransactions(query, user) {
        const scope = await this.scopeFilter(user);
        const allowedMerchantIds = await this.visibleMerchantIds(user);
        if (query.merchantId && allowedMerchantIds && !allowedMerchantIds.includes(query.merchantId)) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '无权查看该商家的积分流水');
        }
        if (query.storeId && user.userType === 'STORE' && query.storeId !== user.storeId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '无权查看该门店的积分流水');
        }
        if (query.userId) {
            await this.assertUserVisible(query.userId, user);
        }
        const createdAt = {};
        if (query.from)
            createdAt.gte = new Date(`${query.from}T00:00:00.000Z`);
        if (query.to)
            createdAt.lte = new Date(`${query.to}T23:59:59.999Z`);
        const where = {
            AND: [
                scope,
                {
                    ...(query.userId ? { userId: query.userId } : {}),
                    ...(query.type ? { type: query.type } : {}),
                    ...(query.merchantId ? { merchantId: query.merchantId } : {}),
                    ...(query.storeId ? { storeId: query.storeId } : {}),
                    ...(query.from || query.to ? { createdAt } : {}),
                },
            ],
        };
        const [rows, total] = await Promise.all([
            this.prisma.pointTransaction.findMany({
                where,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
                include: { user: { select: { id: true, nickname: true, phone: true } } },
            }),
            this.prisma.pointTransaction.count({ where }),
        ]);
        const merchantIds = [...new Set(rows.map((r) => r.merchantId).filter((v) => !!v))];
        const merchants = merchantIds.length
            ? await this.prisma.merchant.findMany({ where: { id: { in: merchantIds } }, select: { id: true, name: true } })
            : [];
        const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));
        const operatorIds = [...new Set(rows.map((r) => r.operatorId).filter((v) => !!v))];
        const operators = operatorIds.length
            ? await this.prisma.adminUser.findMany({
                where: { id: { in: operatorIds } },
                select: { id: true, realName: true, username: true },
            })
            : [];
        const operatorMap = new Map(operators.map((o) => [o.id, o.realName || o.username]));
        return {
            list: rows.map((r) => ({
                id: r.id,
                userId: r.userId,
                userName: r.user?.nickname ?? null,
                userPhone: r.user?.phone ?? null,
                type: r.type,
                amount: r.amount,
                remainingAmount: r.remainingAmount,
                balanceAfter: r.balanceAfter,
                expireAt: r.expireAt,
                merchantId: r.merchantId,
                merchantName: r.merchantId ? merchantMap.get(r.merchantId) ?? null : null,
                storeId: r.storeId,
                relatedOrderId: r.relatedOrderId,
                relatedCouponInstanceId: r.relatedCouponInstanceId,
                sourceTransactionId: r.sourceTransactionId,
                originBatchId: r.originBatchId,
                operatorId: r.operatorId,
                operatorName: r.operatorId ? operatorMap.get(r.operatorId) ?? null : null,
                remark: r.remark,
                createdAt: r.createdAt,
            })),
            total,
            page: query.page,
            pageSize: query.pageSize,
        };
    }
    async expirePoints(opts = {}) {
        if (this.running) {
            return {
                processed: 0,
                expiredAmount: 0,
                startedAt: new Date(),
                finishedAt: new Date(),
                skipped: true,
                message: '已有过期清零任务在执行，本次跳过',
            };
        }
        this.running = true;
        const startedAt = new Date();
        let processed = 0;
        let expiredAmount = 0;
        try {
            const now = new Date();
            while (true) {
                const batch = await this.prisma.pointTransaction.findMany({
                    where: { type: client_1.PointTxnType.EARN, remainingAmount: { gt: 0 }, expireAt: { lt: now } },
                    select: { id: true, userId: true, merchantId: true, storeId: true, remainingAmount: true },
                    orderBy: { expireAt: 'asc' },
                    take: 500,
                });
                if (batch.length === 0)
                    break;
                let done;
                let lastErr = null;
                for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
                    try {
                        done = await this.expireBatch(batch, opts);
                        break;
                    }
                    catch (e) {
                        lastErr = e;
                        if (e instanceof ConcurrentSignal || isTransientLockError(e)) {
                            if (attempt === MAX_RETRY) {
                                this.logger.warn(`积分过期批次处理并发冲突重试耗尽，跳过该批（${batch.length} 条）`);
                                break;
                            }
                            await sleep(20 * attempt + Math.floor(Math.random() * 20));
                            continue;
                        }
                        throw e;
                    }
                }
                if (lastErr && !(lastErr instanceof ConcurrentSignal) && !isTransientLockError(lastErr))
                    throw lastErr;
                processed += done?.count ?? 0;
                expiredAmount += done?.amount ?? 0;
            }
        }
        finally {
            this.running = false;
        }
        await this.audit.record({
            operatorId: opts.operatorId ?? null,
            operatorType: opts.operatorType ?? null,
            module: 'point',
            action: ACTION.expire,
            targetType: 'point_account',
            before: null,
            after: {
                triggeredBy: opts.triggeredBy ?? 'manual',
                processed,
                expiredAmount,
                startedAt,
                finishedAt: new Date(),
            },
            ip: opts.ip ?? null,
            userAgent: opts.userAgent ?? null,
        });
        return { processed, expiredAmount, startedAt, finishedAt: new Date(), skipped: false };
    }
    async expireBatch(batch, opts) {
        return this.prisma.$transaction(async (tx) => {
            const byUser = new Map();
            for (const r of batch) {
                const arr = byUser.get(r.userId);
                if (arr)
                    arr.push(r);
                else
                    byUser.set(r.userId, [r]);
            }
            let count = 0;
            let amount = 0;
            const expireRows = [];
            for (const [userId, rows] of byUser) {
                const acct = await tx.pointAccount.findUnique({ where: { userId } });
                if (!acct)
                    continue;
                let curBalance = acct.balance;
                let userExpired = 0;
                for (const r of rows) {
                    const upd = await tx.pointTransaction.updateMany({
                        where: { id: r.id, remainingAmount: r.remainingAmount },
                        data: { remainingAmount: 0 },
                    });
                    if (upd.count === 0)
                        continue;
                    curBalance -= r.remainingAmount;
                    userExpired += r.remainingAmount;
                    expireRows.push({
                        userId,
                        accountId: acct.id,
                        type: client_1.PointTxnType.EXPIRE,
                        amount: -r.remainingAmount,
                        remainingAmount: 0,
                        balanceAfter: curBalance,
                        expireAt: null,
                        sourceTransactionId: r.id,
                        merchantId: r.merchantId,
                        storeId: r.storeId,
                        operatorId: opts.operatorId ?? null,
                        remark: `批次#${r.id} 过期清零（${r.remainingAmount} 分）`,
                        createdAt: new Date(),
                    });
                    count++;
                }
                if (userExpired > 0) {
                    const affected = await tx.$executeRaw(client_1.Prisma.sql `UPDATE point_accounts SET balance = balance - ${userExpired}, totalExpired = totalExpired + ${userExpired}, version = version + 1 WHERE userId = ${userId} AND version = ${acct.version}`);
                    if (affected === 0)
                        throw new ConcurrentSignal();
                    amount += userExpired;
                }
            }
            if (expireRows.length)
                await tx.pointTransaction.createMany({ data: expireRows });
            return { count, amount };
        });
    }
    async earn(dto, user, ip, ua) {
        const { merchantId, storeId } = await this.resolveMerchantStore(dto, user);
        const target = await this.prisma.user.findUnique({
            where: { id: dto.userId },
            select: { id: true, nickname: true, phone: true, status: true },
        });
        if (!target) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `用户 #${dto.userId} 不存在`);
        }
        const rule = await this.resolveRule(merchantId);
        const order = await this.resolveOrder(dto);
        if (!order) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.ORDER_ID_REQUIRED, '消费录单送积分必须带 orderId 或 orderNo（一单只送一次积分靠它做幂等键）；人工调整请走 POST /points/adjust');
        }
        const amount = Number(dto.amount);
        const minAmount = Number(rule.minAmount);
        if (amount < minAmount) {
            return {
                earned: false,
                points: 0,
                reasonCode: 'BELOW_MIN_AMOUNT',
                message: `消费 ${amount} 元未达起送金额 ${minAmount} 元，本次不送积分`,
                rule: { merchantId: rule.merchantId, earnRatio: Number(rule.earnRatio), minAmount },
            };
        }
        const points = Math.floor(amount * Number(rule.earnRatio));
        if (points <= 0) {
            return {
                earned: false,
                points: 0,
                reasonCode: 'POINTS_ZERO',
                message: `按规则折算后积分为 0（金额 ${amount} × 比例 ${Number(rule.earnRatio)}）`,
                rule: { merchantId: rule.merchantId, earnRatio: Number(rule.earnRatio), minAmount },
            };
        }
        const now = new Date();
        const expireAt = this.computeExpireAt(rule, now);
        let lastErr = null;
        for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
            try {
                return await this.prisma.$transaction(async (tx) => {
                    if (order) {
                        const exist = await tx.pointTransaction.findFirst({
                            where: { relatedOrderId: order.id, type: client_1.PointTxnType.EARN },
                            select: { id: true, amount: true, createdAt: true },
                        });
                        if (exist) {
                            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.ORDER_POINTS_ALREADY_EARNED, `订单 #${order.id}（${order.orderNo}）已送过 ${exist.amount} 积分，不能重复送`);
                        }
                    }
                    const account = await this.ensureAccount(tx, dto.userId);
                    const balanceAfter = account.balance + points;
                    const txn = await tx.pointTransaction.create({
                        data: {
                            userId: dto.userId,
                            accountId: account.id,
                            type: client_1.PointTxnType.EARN,
                            amount: points,
                            remainingAmount: points,
                            balanceAfter,
                            expireAt,
                            relatedOrderId: order?.id ?? null,
                            merchantId,
                            storeId: storeId ?? null,
                            operatorId: user.sub,
                            remark: dto.remark ?? '消费送积分',
                        },
                    });
                    const affected = await tx.$executeRaw(client_1.Prisma.sql `UPDATE point_accounts SET balance = balance + ${points}, totalEarned = totalEarned + ${points}, version = version + 1 WHERE userId = ${dto.userId} AND version = ${account.version}`);
                    if (affected === 0)
                        throw new ConcurrentSignal();
                    await this.audit.record({
                        operatorId: user.sub,
                        operatorType: user.userType,
                        module: 'point',
                        action: ACTION.earn,
                        targetType: 'point_account',
                        targetId: account.id,
                        before: { userId: dto.userId, balance: account.balance, version: account.version },
                        after: { balance: balanceAfter, points, expireAt, orderId: order?.id ?? null, transactionId: txn.id },
                        ip,
                        userAgent: ua,
                    }, tx);
                    return {
                        earned: true,
                        points,
                        transactionId: txn.id,
                        expireAt,
                        balance: balanceAfter,
                        accountId: account.id,
                        rule: { merchantId: rule.merchantId, earnRatio: Number(rule.earnRatio), minAmount },
                    };
                });
            }
            catch (e) {
                lastErr = e;
                if (e instanceof ConcurrentSignal || isTransientLockError(e)) {
                    if (attempt === MAX_RETRY)
                        break;
                    await sleep(20 * attempt + Math.floor(Math.random() * 20));
                    continue;
                }
                if (isEarnOrderUniqueViolation(e)) {
                    throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.ORDER_POINTS_ALREADY_EARNED, `订单 #${order?.id ?? '-'}（${order?.orderNo ?? '-'}）已送过积分，不能重复送`);
                }
                if (isUniqueViolation(e)) {
                    if (attempt === MAX_RETRY)
                        throw e;
                    await sleep(20 * attempt + Math.floor(Math.random() * 20));
                    continue;
                }
                throw e;
            }
        }
        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.CONCURRENT_UPDATE, `积分账户并发更新冲突，已重试 ${MAX_RETRY} 次仍未成功，请稍后重试`);
    }
    async adjust(dto, user, ip, ua) {
        if (dto.amount === 0) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.INVALID_ADJUST_AMOUNT, '调整积分不能为 0');
        }
        await this.assertWritableUser(dto.userId, user);
        const target = await this.prisma.user.findUnique({
            where: { id: dto.userId },
            select: { id: true, nickname: true, phone: true },
        });
        if (!target) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `用户 #${dto.userId} 不存在`);
        }
        const isAdd = dto.amount > 0;
        const points = Math.abs(dto.amount);
        const now = new Date();
        let lastErr = null;
        for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
            try {
                return await this.prisma.$transaction(async (tx) => {
                    const account = await this.ensureAccount(tx, dto.userId);
                    let expireAt = null;
                    let deductions = [];
                    if (isAdd) {
                        if (dto.expireAt) {
                            expireAt = new Date(dto.expireAt);
                        }
                        else {
                            const rule = await this.resolveRule(null);
                            expireAt = this.computeExpireAt(rule, now);
                        }
                    }
                    else {
                        deductions = await this.consumeFifo(tx, dto.userId, points, now);
                    }
                    const balanceAfter = isAdd ? account.balance + points : account.balance - points;
                    if (!isAdd && balanceAfter < 0) {
                        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.BALANCE_NOT_ENOUGH, `可用积分不足：需扣减 ${points}，当前余额 ${account.balance}`);
                    }
                    const txn = await tx.pointTransaction.create({
                        data: {
                            userId: dto.userId,
                            accountId: account.id,
                            type: client_1.PointTxnType.ADJUST,
                            amount: isAdd ? points : -points,
                            remainingAmount: isAdd ? points : 0,
                            balanceAfter,
                            expireAt,
                            operatorId: user.sub,
                            remark: dto.reason,
                        },
                    });
                    const affected = isAdd
                        ? await tx.$executeRaw(client_1.Prisma.sql `UPDATE point_accounts SET balance = balance + ${points}, totalEarned = totalEarned + ${points}, version = version + 1 WHERE userId = ${dto.userId} AND version = ${account.version}`)
                        : await tx.$executeRaw(client_1.Prisma.sql `UPDATE point_accounts SET balance = balance - ${points}, totalSpent = totalSpent + ${points}, version = version + 1 WHERE userId = ${dto.userId} AND version = ${account.version}`);
                    if (affected === 0)
                        throw new ConcurrentSignal();
                    await this.audit.record({
                        operatorId: user.sub,
                        operatorType: user.userType,
                        module: 'point',
                        action: ACTION.adjust,
                        targetType: 'point_account',
                        targetId: account.id,
                        before: { userId: dto.userId, balance: account.balance, version: account.version },
                        after: { balance: balanceAfter, adjust: dto.amount, reason: dto.reason, transactionId: txn.id, deductions },
                        ip,
                        userAgent: ua,
                    }, tx);
                    return {
                        adjusted: true,
                        amount: isAdd ? points : -points,
                        transactionId: txn.id,
                        expireAt,
                        balance: balanceAfter,
                        deductions,
                    };
                });
            }
            catch (e) {
                lastErr = e;
                if (e instanceof ConcurrentSignal || isTransientLockError(e)) {
                    if (attempt === MAX_RETRY)
                        break;
                    await sleep(20 * attempt + Math.floor(Math.random() * 20));
                    continue;
                }
                throw e;
            }
        }
        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.CONCURRENT_UPDATE, `积分账户并发更新冲突（含数据库瞬时死锁），已重试 ${MAX_RETRY} 次仍未成功，请稍后重试`);
    }
    async exchange(dto, user, ip, ua) {
        const target = await this.prisma.user.findUnique({
            where: { id: dto.userId },
            select: { id: true, nickname: true, phone: true },
        });
        if (!target) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `用户 #${dto.userId} 不存在`);
        }
        const exist = await this.prisma.exchangeRecord.findUnique({
            where: { userId_requestId: { userId: dto.userId, requestId: dto.requestId } },
            include: { couponInstance: { select: { id: true, code: true, expireAt: true } } },
        });
        if (exist) {
            return {
                idempotent: true,
                exchangeId: exist.id,
                couponInstanceId: exist.couponInstanceId,
                code: exist.couponInstance?.code ?? null,
                expireAt: exist.couponInstance?.expireAt ?? null,
                pointsCost: exist.pointsCost,
                templateId: exist.templateId,
                createdAt: exist.createdAt,
            };
        }
        const template = await this.prisma.couponTemplate.findUnique({ where: { id: dto.templateId } });
        if (!template) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `券模板 #${dto.templateId} 不存在`);
        }
        if (template.status !== client_1.CouponTemplateStatus.PUBLISHED) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.TEMPLATE_NOT_AVAILABLE, `券模板「${template.name}」当前状态为 ${template.status}，只有已上架的模板可兑换`);
        }
        const pointsCost = template.pointsCost;
        if (pointsCost <= 0) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.TEMPLATE_NOT_EXCHANGEABLE, `券模板「${template.name}」未设置兑换所需积分（pointsCost=${pointsCost}），不支持积分兑换`);
        }
        if (template.totalStock - template.issuedCount < 1) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.STOCK_EXHAUSTED, `券模板「${template.name}」库存不足：本次需 1 张，剩余 ${Math.max(template.totalStock - template.issuedCount, 0)} 张`);
        }
        const owned = await this.prisma.couponInstance.count({
            where: { userId: dto.userId, templateId: dto.templateId },
        });
        if (owned >= template.perUserLimit) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.PER_USER_LIMIT_EXCEEDED, `该用户已兑换「${template.name}」${owned} 张，达到限领 ${template.perUserLimit} 张`);
        }
        const now = new Date();
        const availableRows = await this.prisma.pointTransaction.findMany({
            where: {
                userId: dto.userId,
                remainingAmount: { gt: 0 },
                OR: [{ expireAt: null }, { expireAt: { gt: now } }],
            },
            select: { remainingAmount: true },
        });
        const available = availableRows.reduce((s, r) => s + r.remainingAmount, 0);
        if (available < pointsCost) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.BALANCE_NOT_ENOUGH, `可用积分不足：需 ${pointsCost}，未过期批次可用 ${available}（过期积分不可用于兑换）`);
        }
        let lastErr = null;
        for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
            try {
                return await this.prisma.$transaction(async (tx) => {
                    const codes = await tx.$queryRaw(client_1.Prisma.sql `SELECT id, code FROM coupon_codes WHERE templateId = ${dto.templateId} AND status = 'UNISSUED' ORDER BY id ASC LIMIT 1 FOR UPDATE`);
                    if (codes.length === 0) {
                        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.CODE_POOL_EXHAUSTED, `券模板「${template.name}」券码池已耗尽，请先预生成券码`);
                    }
                    const codeId = Number(codes[0].id);
                    const codeStr = codes[0].code;
                    const codeAffected = await tx.$executeRaw(client_1.Prisma.sql `UPDATE coupon_codes SET status = 'ISSUED' WHERE id = ${codeId} AND status = 'UNISSUED'`);
                    if (codeAffected === 0) {
                        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.CODE_POOL_EXHAUSTED, `券码 #${codeId} 已被占用（并发兑换），请重试`);
                    }
                    const deductions = await this.consumeFifo(tx, dto.userId, pointsCost, now);
                    const account = await this.ensureAccount(tx, dto.userId);
                    const balanceAfter = account.balance - pointsCost;
                    if (balanceAfter < 0) {
                        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.BALANCE_NOT_ENOUGH, `可用积分不足：需 ${pointsCost}，当前余额 ${account.balance}`);
                    }
                    const expireAt = this.computeCouponExpireAt(template, now);
                    const instance = await tx.couponInstance.create({
                        data: {
                            userId: dto.userId,
                            templateId: dto.templateId,
                            code: codeStr,
                            issuerMerchantId: template.ownerMerchantId,
                            source: client_1.CouponSource.EXCHANGE,
                            pointsCost,
                            expireAt,
                        },
                    });
                    await tx.$executeRaw(client_1.Prisma.sql `UPDATE coupon_codes SET instanceId = ${instance.id} WHERE id = ${codeId} AND instanceId IS NULL`);
                    let running = account.balance;
                    for (const d of deductions) {
                        running -= d.amount;
                        await tx.pointTransaction.create({
                            data: {
                                userId: dto.userId,
                                accountId: account.id,
                                type: client_1.PointTxnType.SPEND,
                                amount: -d.amount,
                                remainingAmount: 0,
                                balanceAfter: running,
                                merchantId: template.ownerMerchantId,
                                operatorId: user.sub,
                                relatedCouponInstanceId: instance.id,
                                originBatchId: d.txnId,
                                remark: dto.remark ?? `积分兑换「${template.name}」（批次 #${d.txnId} 扣 ${d.amount}）`,
                            },
                        });
                    }
                    const accAffected = await tx.$executeRaw(client_1.Prisma.sql `UPDATE point_accounts SET balance = balance - ${pointsCost}, totalSpent = totalSpent + ${pointsCost}, version = version + 1 WHERE userId = ${dto.userId} AND version = ${account.version}`);
                    if (accAffected === 0)
                        throw new ConcurrentSignal();
                    const stockAffected = await tx.$executeRaw(client_1.Prisma.sql `UPDATE coupon_templates SET issuedCount = issuedCount + 1, updatedAt = NOW() WHERE id = ${dto.templateId} AND totalStock - issuedCount >= 1`);
                    if (stockAffected === 0) {
                        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.STOCK_EXHAUSTED, `券模板「${template.name}」库存不足（并发兑换已抢完），请稍后再试`);
                    }
                    const record = await tx.exchangeRecord.create({
                        data: {
                            userId: dto.userId,
                            templateId: dto.templateId,
                            couponInstanceId: instance.id,
                            pointsCost,
                            requestId: dto.requestId,
                            channel: dto.channel ?? 'H5',
                            merchantId: template.ownerMerchantId,
                            operatorId: user.sub,
                            remark: dto.remark ?? null,
                        },
                    });
                    await this.audit.record({
                        operatorId: user.sub,
                        operatorType: user.userType,
                        module: 'point',
                        action: ACTION.exchange,
                        targetType: 'exchange_record',
                        targetId: record.id,
                        before: {
                            userId: dto.userId,
                            balance: account.balance,
                            version: account.version,
                            available,
                        },
                        after: {
                            balance: balanceAfter,
                            pointsCost,
                            couponInstanceId: instance.id,
                            code: codeStr,
                            deductions,
                            requestId: dto.requestId,
                        },
                        ip,
                        userAgent: ua,
                    }, tx);
                    return {
                        idempotent: false,
                        exchangeId: record.id,
                        couponInstanceId: instance.id,
                        code: codeStr,
                        expireAt,
                        pointsCost,
                        balance: balanceAfter,
                        deductions,
                    };
                });
            }
            catch (e) {
                lastErr = e;
                if (isUniqueViolation(e)) {
                    const prev = await this.prisma.exchangeRecord.findUnique({
                        where: { userId_requestId: { userId: dto.userId, requestId: dto.requestId } },
                        include: { couponInstance: { select: { id: true, code: true, expireAt: true } } },
                    });
                    if (prev) {
                        return {
                            idempotent: true,
                            exchangeId: prev.id,
                            couponInstanceId: prev.couponInstanceId,
                            code: prev.couponInstance?.code ?? null,
                            expireAt: prev.couponInstance?.expireAt ?? null,
                            pointsCost: prev.pointsCost,
                            templateId: prev.templateId,
                            createdAt: prev.createdAt,
                        };
                    }
                }
                if (e instanceof ConcurrentSignal || isTransientLockError(e)) {
                    if (attempt === MAX_RETRY)
                        break;
                    await sleep(20 * attempt + Math.floor(Math.random() * 20));
                    continue;
                }
                throw e;
            }
        }
        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.CONCURRENT_UPDATE, `积分兑换并发冲突（含数据库瞬时死锁），已重试 ${MAX_RETRY} 次仍未成功，请稍后重试`);
    }
    async listExchangeRecords(query, user) {
        if (query.userId) {
            await this.assertUserVisible(query.userId, user);
        }
        const merchantIds = await this.visibleMerchantIds(user);
        const createdAt = {};
        if (query.from)
            createdAt.gte = new Date(`${query.from}T00:00:00.000Z`);
        if (query.to)
            createdAt.lte = new Date(`${query.to}T23:59:59.999Z`);
        const where = {
            AND: [
                user.userType === 'PLATFORM'
                    ? {}
                    : { OR: [{ merchantId: { in: merchantIds ?? [] } }, ...(merchantIds && merchantIds.includes(user.merchantId ?? 0) ? [{ merchantId: null }] : [])] },
                {
                    ...(query.userId ? { userId: query.userId } : {}),
                    ...(query.templateId ? { templateId: query.templateId } : {}),
                    ...(query.from || query.to ? { createdAt } : {}),
                },
            ],
        };
        const [rows, total] = await Promise.all([
            this.prisma.exchangeRecord.findMany({
                where,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
                include: {
                    user: { select: { id: true, nickname: true, phone: true } },
                    template: { select: { id: true, name: true, faceValue: true } },
                    couponInstance: { select: { id: true, code: true, status: true, expireAt: true } },
                },
            }),
            this.prisma.exchangeRecord.count({ where }),
        ]);
        return {
            list: rows.map((r) => ({
                id: r.id,
                userId: r.userId,
                userName: r.user?.nickname ?? null,
                userPhone: r.user?.phone ?? null,
                templateId: r.templateId,
                templateName: r.template?.name ?? null,
                faceValue: r.template ? Number(r.template.faceValue) : null,
                couponInstanceId: r.couponInstanceId,
                code: r.couponInstance?.code ?? null,
                couponStatus: r.couponInstance?.status ?? null,
                couponExpireAt: r.couponInstance?.expireAt ?? null,
                pointsCost: r.pointsCost,
                requestId: r.requestId,
                channel: r.channel,
                operatorId: r.operatorId,
                remark: r.remark,
                createdAt: r.createdAt,
            })),
            total,
            page: query.page,
            pageSize: query.pageSize,
        };
    }
    async listRules(user) {
        const where = user.userType === 'PLATFORM'
            ? {}
            : { OR: [{ merchantId: user.merchantId ?? 0 }, { merchantId: 0 }] };
        const rows = await this.prisma.pointRule.findMany({ where, orderBy: [{ merchantId: 'asc' }, { id: 'asc' }] });
        return {
            list: rows.map((r) => ({
                id: r.id,
                merchantId: r.merchantId,
                level: r.merchantId === 0 ? 'PLATFORM' : 'MERCHANT',
                earnRatio: Number(r.earnRatio),
                minAmount: Number(r.minAmount),
                pointsValidMonths: r.pointsValidMonths,
                expireMode: r.expireMode,
                status: r.status,
                effectiveAt: r.effectiveAt,
                updatedAt: r.updatedAt,
            })),
        };
    }
    async updateRule(id, dto, user, ip, ua) {
        const rule = await this.prisma.pointRule.findUnique({ where: { id } });
        if (!rule) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `积分规则 #${id} 不存在`);
        }
        if (user.userType !== 'PLATFORM' && rule.merchantId !== user.merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '只能修改本商家的积分规则');
        }
        const before = {
            earnRatio: Number(rule.earnRatio),
            minAmount: Number(rule.minAmount),
            pointsValidMonths: rule.pointsValidMonths,
            expireMode: rule.expireMode,
            status: rule.status,
        };
        try {
            const updated = await this.prisma.pointRule.update({
                where: { id },
                data: {
                    ...(dto.earnRatio !== undefined ? { earnRatio: dto.earnRatio } : {}),
                    ...(dto.minAmount !== undefined ? { minAmount: dto.minAmount } : {}),
                    ...(dto.pointsValidMonths !== undefined ? { pointsValidMonths: dto.pointsValidMonths } : {}),
                    ...(dto.expireMode !== undefined ? { expireMode: dto.expireMode } : {}),
                    ...(dto.status !== undefined ? { status: dto.status } : {}),
                },
            });
            await this.audit.record({
                operatorId: user.sub,
                operatorType: user.userType,
                module: 'point',
                action: ACTION.ruleUpdate,
                targetType: 'point_rule',
                targetId: id,
                before,
                after: {
                    earnRatio: Number(updated.earnRatio),
                    minAmount: Number(updated.minAmount),
                    pointsValidMonths: updated.pointsValidMonths,
                    expireMode: updated.expireMode,
                    status: updated.status,
                },
                ip,
                userAgent: ua,
            });
            return { rule: { id: updated.id, merchantId: updated.merchantId, ...{
                        earnRatio: Number(updated.earnRatio),
                        minAmount: Number(updated.minAmount),
                        pointsValidMonths: updated.pointsValidMonths,
                        expireMode: updated.expireMode,
                        status: updated.status,
                    } } };
        }
        catch (e) {
            if (isPointRuleUniqueViolation(e)) {
                throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.POINT_RULE_ALREADY_ACTIVE, `商家 #${rule.merchantId} 已有一条生效中的积分规则，请先停用再启用`);
            }
            throw e;
        }
    }
    async consumeFifo(tx, userId, points, now) {
        const raw = await tx.$queryRaw(client_1.Prisma.sql `
        SELECT id, remainingAmount, expireAt
        FROM point_transactions
        WHERE userId = ${userId}
          AND type IN ('EARN', 'ADJUST', 'REFUND')
          AND remainingAmount > 0
          AND (expireAt IS NULL OR expireAt > ${now})
        ORDER BY (expireAt IS NULL), expireAt ASC, id ASC
        FOR UPDATE`);
        const batches = raw.map((b) => ({
            id: Number(b.id),
            remainingAmount: Number(b.remainingAmount),
            expireAt: b.expireAt,
        }));
        const available = batches.reduce((s, b) => s + b.remainingAmount, 0);
        if (available < points) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.BALANCE_NOT_ENOUGH, `可用积分不足：需 ${points}，未过期批次可用 ${available}（过期积分不可用于扣减）`);
        }
        const deductions = [];
        let need = points;
        for (const b of batches) {
            if (need <= 0)
                break;
            const take = Math.min(b.remainingAmount, need);
            const affected = await tx.$executeRaw(client_1.Prisma.sql `UPDATE point_transactions SET remainingAmount = remainingAmount - ${take} WHERE id = ${b.id} AND remainingAmount >= ${take}`);
            if (affected === 0) {
                throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.BALANCE_NOT_ENOUGH, '积分批次并发扣减冲突，请重试');
            }
            deductions.push({ txnId: b.id, amount: take, expireAt: b.expireAt });
            need -= take;
        }
        if (need > 0) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.BALANCE_NOT_ENOUGH, `可用积分不足：还差 ${need} 分（FIFO 扣减中途发现批次不足）`);
        }
        return deductions;
    }
    async refundExchangePoints(tx, couponInstanceId, operatorId) {
        const spends = await tx.pointTransaction.findMany({
            where: {
                relatedCouponInstanceId: couponInstanceId,
                type: client_1.PointTxnType.SPEND,
                originBatchId: { not: null },
            },
            orderBy: { id: 'asc' },
        });
        if (spends.length === 0)
            return { total: 0, details: [] };
        const userId = spends[0].userId;
        const account = await tx.pointAccount.findUnique({ where: { userId } });
        if (!account)
            return { total: 0, details: [] };
        let total = 0;
        const details = [];
        let running = account.balance;
        for (const s of spends) {
            const take = -s.amount;
            const sourceId = s.originBatchId;
            await tx.$executeRaw(client_1.Prisma.sql `UPDATE point_transactions SET remainingAmount = remainingAmount + ${take} WHERE id = ${sourceId}`);
            running += take;
            await tx.pointTransaction.create({
                data: {
                    userId,
                    accountId: account.id,
                    type: client_1.PointTxnType.REFUND,
                    amount: take,
                    remainingAmount: 0,
                    balanceAfter: running,
                    merchantId: s.merchantId,
                    operatorId,
                    relatedCouponInstanceId: couponInstanceId,
                    originBatchId: sourceId,
                    remark: `订单回退：退回批次 #${sourceId} 的 ${take} 分（保留原有效期）`,
                },
            });
            total += take;
            details.push({ sourceTxnId: sourceId, amount: take });
        }
        if (total > 0) {
            const affected = await tx.$executeRaw(client_1.Prisma.sql `UPDATE point_accounts SET balance = balance + ${total}, totalSpent = totalSpent - ${total}, version = version + 1 WHERE userId = ${userId} AND version = ${account.version}`);
            if (affected === 0)
                throw new ConcurrentSignal();
        }
        return { total, details };
    }
    async adjustInTx(tx, userId, amount, operatorId, reason) {
        const points = Math.abs(amount);
        const now = new Date();
        await this.consumeFifo(tx, userId, points, now);
        const account = await this.ensureAccount(tx, userId);
        const balanceAfter = account.balance - points;
        await tx.pointTransaction.create({
            data: {
                userId,
                accountId: account.id,
                type: client_1.PointTxnType.ADJUST,
                amount: -points,
                remainingAmount: 0,
                balanceAfter,
                operatorId,
                remark: reason,
            },
        });
        const affected = await tx.$executeRaw(client_1.Prisma.sql `UPDATE point_accounts SET balance = balance - ${points}, totalSpent = totalSpent + ${points}, version = version + 1 WHERE userId = ${userId} AND version = ${account.version}`);
        if (affected === 0)
            throw new ConcurrentSignal();
        return { balanceAfter };
    }
    async ensureAccount(tx, userId) {
        return tx.pointAccount.upsert({ where: { userId }, create: { userId }, update: {} });
    }
    async resolveMerchantStore(dto, user) {
        if (user.userType === 'PLATFORM') {
            const merchantId = dto.merchantId;
            if (!merchantId) {
                throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.MERCHANT_ID_REQUIRED, '平台管理员录单必须指定 merchantId');
            }
            return this.assertStore(merchantId, dto.storeId ?? null);
        }
        if (user.userType === 'STORE') {
            if (!user.storeId) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '店员账号未绑定门店');
            }
            const store = await this.prisma.store.findUnique({
                where: { id: user.storeId },
                select: { id: true, merchantId: true },
            });
            if (!store) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '店员绑定的门店不存在');
            }
            if (dto.storeId && dto.storeId !== store.id) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, '店员只能录本门店的消费');
            }
            if (dto.merchantId && dto.merchantId !== store.merchantId) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '无权为其他商家录单送积分');
            }
            return { merchantId: store.merchantId, storeId: store.id };
        }
        const merchantId = user.merchantId;
        if (!merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '账号未关联商家');
        }
        if (dto.merchantId && dto.merchantId !== merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '无权为其他商家录单送积分');
        }
        return this.assertStore(merchantId, dto.storeId ?? null);
    }
    async assertStore(merchantId, storeId) {
        if (!storeId)
            return { merchantId, storeId: null };
        const store = await this.prisma.store.findUnique({
            where: { id: storeId },
            select: { id: true, merchantId: true, merchant: { select: { id: true, parentId: true } } },
        });
        if (!store) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, `门店 #${storeId} 不存在`);
        }
        const own = store.merchantId === merchantId;
        const childOfMine = store.merchant?.parentId === merchantId;
        if (!own && !childOfMine) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, `门店 #${storeId} 不属于商家 #${merchantId} 及其附属`);
        }
        return { merchantId: store.merchantId, storeId };
    }
    async resolveOrder(dto) {
        let order = null;
        if (dto.orderId) {
            order = await this.prisma.order.findUnique({
                where: { id: dto.orderId },
                select: { id: true, orderNo: true, userId: true },
            });
            if (!order) {
                throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `订单 #${dto.orderId} 不存在`);
            }
        }
        else if (dto.orderNo) {
            order = await this.prisma.order.findUnique({
                where: { orderNo: dto.orderNo },
                select: { id: true, orderNo: true, userId: true },
            });
            if (!order) {
                throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `订单 ${dto.orderNo} 不存在`);
            }
        }
        if (order && order.userId !== dto.userId) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `订单 ${order.orderNo} 不属于用户 #${dto.userId}，不能给他送积分`);
        }
        return order;
    }
    async resolveRule(merchantId) {
        if (merchantId) {
            const merchantRule = await this.prisma.pointRule.findFirst({
                where: { merchantId, status: 1 },
                orderBy: { id: 'desc' },
            });
            if (merchantRule)
                return merchantRule;
        }
        const platformRule = await this.prisma.pointRule.findFirst({
            where: { merchantId: 0, status: 1 },
            orderBy: { id: 'desc' },
        });
        if (platformRule)
            return platformRule;
        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.POINT_RULE_NOT_FOUND, '没有生效中的积分规则（商家级与平台级都没有），请先配置积分规则');
    }
    computeCouponExpireAt(template, now) {
        if (template.validType === 'FIXED') {
            const end = template.validEnd ?? new Date(now.getTime() + template.validDays * 86400_000);
            return end.getTime() > now.getTime() ? end : now;
        }
        return new Date(now.getTime() + (template.validDays || 30) * 86400_000);
    }
    computeExpireAt(rule, now) {
        if (rule.expireMode === client_1.ExpireMode.YEAR_END) {
            return new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59));
        }
        const d = new Date(now);
        d.setMonth(d.getMonth() + rule.pointsValidMonths);
        return d;
    }
    async scopeFilter(user) {
        if (user.userType === 'PLATFORM')
            return {};
        if (user.userType === 'STORE') {
            if (!user.storeId)
                return { id: -1 };
            return { storeId: user.storeId };
        }
        const merchantId = user.merchantId;
        if (!merchantId)
            return { id: -1 };
        const merchants = await this.prisma.merchant.findMany({
            where: { OR: [{ id: merchantId }, { parentId: merchantId }] },
            select: { id: true, type: true },
        });
        const ids = merchants.map((m) => m.id);
        const self = merchants.find((m) => m.id === merchantId);
        if (self?.type === client_1.MerchantType.MAIN) {
            return { OR: [{ merchantId: { in: ids } }, { merchantId: null }] };
        }
        return { merchantId: { in: ids } };
    }
    async visibleMerchantIds(user) {
        if (user.userType === 'PLATFORM')
            return null;
        if (user.userType === 'STORE') {
            if (!user.storeId)
                return [];
            const store = await this.prisma.store.findUnique({
                where: { id: user.storeId },
                select: { merchantId: true },
            });
            return store ? [store.merchantId] : [];
        }
        const merchantId = user.merchantId;
        if (!merchantId)
            return [];
        const merchants = await this.prisma.merchant.findMany({
            where: { OR: [{ id: merchantId }, { parentId: merchantId }] },
            select: { id: true },
        });
        return merchants.map((m) => m.id);
    }
    async assertWritableUser(userId, user) {
        if (user.userType === 'PLATFORM')
            return;
        if (user.userType === 'MERCHANT' && user.merchantId) {
            const self = await this.prisma.merchant.findUnique({
                where: { id: user.merchantId },
                select: { type: true },
            });
            if (self?.type === client_1.MerchantType.MAIN)
                return;
        }
        await this.assertUserVisible(userId, user);
    }
    async assertUserVisible(userId, user) {
        if (user.userType === 'PLATFORM')
            return;
        const scope = await this.scopeFilter(user);
        const hit = await this.prisma.pointTransaction.findFirst({
            where: { userId, ...scope },
            select: { id: true },
        });
        if (!hit) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '无权查看该用户的积分数据');
        }
    }
};
exports.PointService = PointService;
exports.PointService = PointService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], PointService);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function isUniqueViolation(e) {
    const code = e?.code;
    const msg = e?.message ?? '';
    return code === 'P2002' || msg.includes('Duplicate entry');
}
function isEarnOrderUniqueViolation(e) {
    if (!isUniqueViolation(e))
        return false;
    const target = e?.meta?.target;
    const s = Array.isArray(target) ? target.join(',') : String(target ?? '');
    return s.includes('relatedOrderId') || s.includes('uniq_point_earn_order');
}
function isPointRuleUniqueViolation(e) {
    if (!isUniqueViolation(e))
        return false;
    const target = e?.meta?.target;
    const s = Array.isArray(target) ? target.join(',') : String(target ?? '');
    return s.includes('point_rules') || s.includes('merchantId');
}
function isTransientLockError(e) {
    const msg = e?.message ?? '';
    const code = e?.code;
    return (code === 'P2034' ||
        msg.includes('Deadlock found') ||
        msg.includes('Lock wait timeout') ||
        msg.includes('deadlock detected'));
}
//# sourceMappingURL=point.service.js.map