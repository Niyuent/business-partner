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
exports.OrderService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const audit_service_1 = require("../audit-log/audit.service");
const point_service_1 = require("../point/point.service");
const MAX_RETRY = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ACTION = {
    create: 'ORDER_CREATE',
    markAbnormal: 'ORDER_MARK_ABNORMAL',
    handle: 'ORDER_HANDLE',
};
let OrderService = class OrderService {
    constructor(prisma, audit, points) {
        this.prisma = prisma;
        this.audit = audit;
        this.points = points;
        this.logger = new common_1.Logger('Order');
    }
    async list(query, user) {
        const scope = await this.orderScope(user);
        const createdAt = {};
        if (query.from)
            createdAt.gte = new Date(`${query.from}T00:00:00.000Z`);
        if (query.to)
            createdAt.lte = new Date(`${query.to}T23:59:59.999Z`);
        const where = {
            AND: [
                scope,
                {
                    ...(query.status ? { status: query.status } : {}),
                    ...(query.orderNo ? { orderNo: { contains: query.orderNo } } : {}),
                    ...(query.userId ? { userId: query.userId } : {}),
                    ...(query.storeId ? { storeId: query.storeId } : {}),
                    ...(query.from || query.to ? { createdAt } : {}),
                },
            ],
        };
        const [rows, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                orderBy: [{ id: 'desc' }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
                include: {
                    user: { select: { id: true, nickname: true, phone: true } },
                    couponInstance: { select: { id: true, code: true, status: true } },
                    store: { select: { id: true, name: true } },
                },
            }),
            this.prisma.order.count({ where }),
        ]);
        const merchantIds = [...new Set(rows.map((r) => r.merchantId))];
        const merchants = merchantIds.length
            ? await this.prisma.merchant.findMany({ where: { id: { in: merchantIds } }, select: { id: true, name: true } })
            : [];
        const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));
        return {
            list: rows.map((r) => ({
                id: r.id,
                orderNo: r.orderNo,
                userId: r.userId,
                userName: r.user?.nickname ?? null,
                userPhone: r.user?.phone ?? null,
                merchantId: r.merchantId,
                merchantName: merchantMap.get(r.merchantId) ?? null,
                storeId: r.storeId,
                storeName: r.store?.name ?? null,
                orderType: r.orderType,
                totalAmount: Number(r.totalAmount),
                payAmount: Number(r.payAmount),
                pointsEarned: r.pointsEarned,
                status: r.status,
                abnormalType: r.abnormalType,
                couponInstanceId: r.couponInstanceId,
                couponCode: r.couponInstance?.code ?? null,
                couponStatus: r.couponInstance?.status ?? null,
                handleResult: r.handleResult,
                handledAt: r.handledAt,
                consumeTime: r.consumeTime,
                createdAt: r.createdAt,
            })),
            total,
            page: query.page,
            pageSize: query.pageSize,
        };
    }
    async detail(id, user) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, nickname: true, phone: true } },
                store: { select: { id: true, name: true } },
                couponInstance: {
                    include: { template: { select: { id: true, name: true, faceValue: true, thresholdAmount: true } } },
                },
            },
        });
        if (!order)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `订单 #${id} 不存在`);
        await this.assertOrderVisible(order, user);
        const merchant = await this.prisma.merchant.findUnique({ where: { id: order.merchantId }, select: { name: true } });
        const redemptions = await this.prisma.redemptionRecord.findMany({
            where: { OR: [{ orderId: order.id }, { couponInstanceId: order.couponInstanceId ?? -1 }] },
            orderBy: { redeemedAt: 'desc' },
        });
        const pointTxns = await this.prisma.pointTransaction.findMany({
            where: {
                OR: [
                    { relatedOrderId: order.id },
                    ...(order.couponInstanceId ? [{ relatedCouponInstanceId: order.couponInstanceId }] : []),
                ],
            },
            orderBy: { id: 'asc' },
        });
        return {
            order: {
                id: order.id,
                orderNo: order.orderNo,
                userId: order.userId,
                userName: order.user?.nickname ?? null,
                userPhone: order.user?.phone ?? null,
                merchantId: order.merchantId,
                merchantName: merchant?.name ?? null,
                storeId: order.storeId,
                storeName: order.store?.name ?? null,
                orderType: order.orderType,
                totalAmount: Number(order.totalAmount),
                discountAmount: Number(order.discountAmount),
                payAmount: Number(order.payAmount),
                pointsEarned: order.pointsEarned,
                status: order.status,
                abnormalType: order.abnormalType,
                abnormalRemark: order.abnormalRemark,
                handledBy: order.handledBy,
                handledAt: order.handledAt,
                handleResult: order.handleResult,
                source: order.source,
                consumeTime: order.consumeTime,
                createdAt: order.createdAt,
                couponInstance: order.couponInstance
                    ? {
                        id: order.couponInstance.id,
                        code: order.couponInstance.code,
                        status: order.couponInstance.status,
                        templateName: order.couponInstance.template?.name ?? null,
                        faceValue: Number(order.couponInstance.template?.faceValue ?? 0),
                    }
                    : null,
            },
            redemptions: redemptions.map((r) => ({
                id: r.id,
                code: r.code,
                status: r.status,
                faceValue: Number(r.faceValue),
                discountAmount: Number(r.discountAmount),
                redeemedAt: r.redeemedAt,
                reverseReason: r.reverseReason,
                reversedAt: r.reversedAt,
            })),
            pointTxns: pointTxns.map((p) => ({
                id: p.id,
                type: p.type,
                amount: p.amount,
                remainingAmount: p.remainingAmount,
                balanceAfter: p.balanceAfter,
                sourceTransactionId: p.sourceTransactionId,
                originBatchId: p.originBatchId,
                relatedOrderId: p.relatedOrderId,
                relatedCouponInstanceId: p.relatedCouponInstanceId,
                remark: p.remark,
                createdAt: p.createdAt,
            })),
        };
    }
    async listAbnormal(query, user) {
        return this.list({ ...query, status: 'ABNORMAL' }, user);
    }
    async create(dto, user, ip, ua) {
        const { merchantId, storeId } = await this.resolveCreateScope(dto, user);
        const order = await this.prisma.order.create({
            data: {
                orderNo: dto.orderNo,
                userId: dto.userId,
                merchantId,
                storeId,
                orderType: dto.orderType ?? 'CONSUME',
                totalAmount: dto.totalAmount,
                discountAmount: dto.discountAmount ?? 0,
                payAmount: dto.payAmount ?? dto.totalAmount,
                source: dto.source ?? 'IMPORT',
            },
        });
        let points = null;
        if (dto.amount !== undefined && dto.amount > 0) {
            try {
                points = await this.points.earn({
                    userId: dto.userId,
                    amount: dto.amount,
                    orderId: order.id,
                    merchantId,
                    storeId: storeId ?? undefined,
                    remark: dto.remark,
                }, user, ip, ua);
            }
            catch (e) {
                await this.prisma.order.delete({ where: { id: order.id } }).catch(() => undefined);
                throw e;
            }
        }
        await this.audit.record({
            operatorId: user.sub,
            operatorType: user.userType,
            module: 'order',
            action: ACTION.create,
            targetType: 'order',
            targetId: order.id,
            after: { orderNo: order.orderNo, totalAmount: dto.totalAmount, points },
            ip: ip ?? null,
            userAgent: ua ?? null,
        });
        return { order: { id: order.id, orderNo: order.orderNo, status: order.status }, points };
    }
    async markAbnormal(id, dto, user, ip, ua) {
        const order = await this.prisma.order.findUnique({ where: { id } });
        if (!order)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `订单 #${id} 不存在`);
        await this.assertOrderVisible(order, user);
        const updated = await this.prisma.$transaction(async (tx) => {
            const affected = await tx.$executeRaw(client_1.Prisma.sql `UPDATE orders SET status = 'ABNORMAL', abnormalType = ${dto.abnormalType}, abnormalRemark = ${dto.abnormalRemark}, updatedAt = NOW() WHERE id = ${id} AND status = 'NORMAL'`);
            if (affected === 0) {
                throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.ORDER_NOT_ABNORMAL, '只有 NORMAL 订单才能标记异常（可能已处理或已是异常）');
            }
            return tx.order.findUnique({ where: { id } });
        });
        await this.audit.record({
            operatorId: user.sub,
            operatorType: user.userType,
            module: 'order',
            action: ACTION.markAbnormal,
            targetType: 'order',
            targetId: id,
            before: { status: order.status },
            after: { status: updated?.status, abnormalType: dto.abnormalType, abnormalRemark: dto.abnormalRemark },
            ip: ip ?? null,
            userAgent: ua ?? null,
        });
        return {
            id,
            status: updated?.status,
            abnormalType: dto.abnormalType,
            abnormalRemark: dto.abnormalRemark,
        };
    }
    async handle(id, dto, user, ip, ua) {
        const order = await this.prisma.order.findUnique({ where: { id } });
        if (!order)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `订单 #${id} 不存在`);
        await this.assertOrderVisible(order, user);
        await this.assertHandleAllowed(user);
        if (order.status !== client_1.OrderStatus.ABNORMAL) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.ORDER_NOT_ABNORMAL, '只有异常订单才能处理');
        }
        const now = new Date();
        let lastErr = null;
        for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
            try {
                return await this.prisma.$transaction(async (tx) => {
                    const claimed = await tx.$executeRaw(client_1.Prisma.sql `UPDATE orders SET handledBy = ${user.sub}, handledAt = ${now} WHERE id = ${id} AND status = 'ABNORMAL' AND handledBy IS NULL`);
                    if (claimed === 0) {
                        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.ORDER_ALREADY_HANDLED, '该异常订单已被处理');
                    }
                    let finalStatus;
                    let refundInfo = null;
                    if (dto.handleType === 'CANCEL' || dto.handleType === 'DISPUTE') {
                        finalStatus = dto.handleType === 'CANCEL' ? client_1.OrderStatus.CANCELED : client_1.OrderStatus.REFUNDED;
                        if (order.couponInstanceId) {
                            await tx.$executeRaw(client_1.Prisma.sql `UPDATE redemption_records SET status = 'REVERSED', reverseReason = ${dto.result ?? '异常订单处理'}, reversedAt = ${now} WHERE couponInstanceId = ${order.couponInstanceId} AND status = 'SUCCESS'`);
                            await tx.$executeRaw(client_1.Prisma.sql `UPDATE coupon_instances SET status = 'UNUSED', usedAt = NULL, updatedAt = NOW() WHERE id = ${order.couponInstanceId} AND status = 'USED'`);
                            refundInfo = await this.points.refundExchangePoints(tx, order.couponInstanceId, user.sub);
                            await tx.order.update({ where: { id }, data: { couponInstanceId: null } });
                        }
                    }
                    else {
                        finalStatus = client_1.OrderStatus.NORMAL;
                        if (order.pointsEarned > 0) {
                            await this.points.adjustInTx(tx, order.userId, -order.pointsEarned, user.sub, `订单 #${order.id} 金额录入错误冲正 ${order.pointsEarned} 分`);
                        }
                    }
                    const result = dto.result ?? this.defaultResult(dto.handleType, refundInfo, order);
                    const updated = await tx.order.update({
                        where: { id },
                        data: { status: finalStatus, handleResult: result },
                    });
                    await this.audit.record({
                        operatorId: user.sub,
                        operatorType: user.userType,
                        module: 'order',
                        action: ACTION.handle,
                        targetType: 'order',
                        targetId: id,
                        before: { status: order.status, abnormalType: order.abnormalType, couponInstanceId: order.couponInstanceId },
                        after: {
                            status: updated.status,
                            handleType: dto.handleType,
                            handleResult: result,
                            refundTotal: refundInfo?.total ?? 0,
                        },
                        ip: ip ?? null,
                        userAgent: ua ?? null,
                    }, tx);
                    return {
                        id,
                        status: updated.status,
                        handleType: dto.handleType,
                        handleResult: result,
                        refund: refundInfo,
                    };
                });
            }
            catch (e) {
                lastErr = e;
                if (e instanceof point_service_1.ConcurrentSignal) {
                    if (attempt === MAX_RETRY)
                        break;
                    await sleep(20 * attempt + Math.floor(Math.random() * 20));
                    continue;
                }
                throw e;
            }
        }
        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.CONCURRENT_UPDATE, `订单并发处理冲突，已重试 ${MAX_RETRY} 次，请稍后重试`);
    }
    defaultResult(handleType, refund, order) {
        if (handleType === 'CANCEL')
            return `订单取消：券已退回，积分回退 ${refund?.total ?? 0} 分`;
        if (handleType === 'DISPUTE')
            return `核销争议冲正：核销已冲正，积分回退 ${refund?.total ?? 0} 分`;
        return `金额录入错误：冲正 ${order.pointsEarned} 分`;
    }
    async resolveCreateScope(dto, user) {
        if (user.userType === 'PLATFORM') {
            if (!dto.merchantId) {
                throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.MERCHANT_ID_REQUIRED, '平台管理员补录订单必须指定 merchantId');
            }
            if (dto.storeId) {
                const store = await this.prisma.store.findUnique({ where: { id: dto.storeId }, select: { merchantId: true } });
                if (!store || store.merchantId !== dto.merchantId) {
                    throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, `门店 #${dto.storeId} 不属于商家 #${dto.merchantId}`);
                }
            }
            return { merchantId: dto.merchantId, storeId: dto.storeId ?? null };
        }
        if (user.userType === 'STORE') {
            const store = await this.prisma.store.findUnique({ where: { id: user.storeId ?? -1 }, select: { id: true, merchantId: true } });
            if (!store)
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '店员账号未绑定门店');
            if (dto.merchantId && dto.merchantId !== store.merchantId) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '无权为其他商家补录订单');
            }
            return { merchantId: store.merchantId, storeId: store.id };
        }
        const merchantId = user.merchantId;
        if (!merchantId)
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '账号未关联商家');
        if (dto.merchantId && dto.merchantId !== merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '无权为其他商家补录订单');
        }
        return { merchantId, storeId: dto.storeId ?? null };
    }
    async orderScope(user) {
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
            select: { id: true },
        });
        return { merchantId: { in: merchants.map((m) => m.id) } };
    }
    async assertOrderVisible(order, user) {
        if (user.userType === 'PLATFORM')
            return;
        if (user.userType === 'STORE') {
            if (order.storeId !== user.storeId) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, '无权查看/处理别家门店的订单');
            }
            return;
        }
        const merchantId = user.merchantId;
        if (!merchantId)
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '账号未关联商家');
        const merchants = await this.prisma.merchant.findMany({
            where: { OR: [{ id: merchantId }, { parentId: merchantId }] },
            select: { id: true },
        });
        if (!merchants.some((m) => m.id === order.merchantId)) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, '无权处理别家商家的订单');
        }
    }
    async assertHandleAllowed(user) {
        if (user.userType === 'PLATFORM')
            return;
        if (user.userType === 'STORE') {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.ORDER_HANDLE_FORBIDDEN, '异常订单处理权归主体商家');
        }
        const self = await this.prisma.merchant.findUnique({ where: { id: user.merchantId ?? -1 }, select: { type: true } });
        if (!self || self.type !== client_1.MerchantType.MAIN) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.ORDER_HANDLE_FORBIDDEN, '异常订单处理权归主体商家，附属商家只能标记异常');
        }
    }
};
exports.OrderService = OrderService;
exports.OrderService = OrderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        point_service_1.PointService])
], OrderService);
//# sourceMappingURL=order.service.js.map