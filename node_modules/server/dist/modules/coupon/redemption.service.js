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
exports.RedemptionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const audit_service_1 = require("../audit-log/audit.service");
const ACTION = {
    redeem: 'redemption:create',
    reverse: 'redemption:reverse',
};
const REVERSE_WINDOW_MS = 24 * 60 * 60 * 1000;
function httpStatusFor(reasonCode) {
    switch (reasonCode) {
        case biz_exception_1.ReasonCode.CODE_NOT_FOUND:
        case biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND:
            return common_1.HttpStatus.NOT_FOUND;
        case biz_exception_1.ReasonCode.STORE_NOT_IN_SCOPE:
        case biz_exception_1.ReasonCode.STORE_NOT_OWNED:
        case biz_exception_1.ReasonCode.FORBIDDEN_SCOPE:
            return common_1.HttpStatus.FORBIDDEN;
        default:
            return common_1.HttpStatus.CONFLICT;
    }
}
let RedemptionService = class RedemptionService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
        this.logger = new common_1.Logger('Redemption');
    }
    async verify(dto, user) {
        const ctx = await this.resolveContext(dto, user);
        if (!ctx.instance) {
            throw new biz_exception_1.BizException(biz_exception_1.ReasonCode.CODE_NOT_FOUND, `券码 ${dto.code} 不存在`, common_1.HttpStatus.NOT_FOUND, { redeemable: false, coupon: null, store: ctx.store ? { id: ctx.store.id, name: ctx.store.name } : null, checks: ctx.checks });
        }
        const { failure, checks } = await this.runChecks(ctx, dto);
        const instance = ctx.instance;
        const coupon = {
            instanceId: instance.id,
            code: instance.code,
            templateId: instance.templateId,
            templateName: instance.template?.name ?? null,
            faceValue: Number(instance.template?.faceValue ?? 0),
            thresholdAmount: Number(instance.template?.thresholdAmount ?? 0),
            status: instance.status,
            userId: instance.userId,
            userName: instance.user?.nickname ?? null,
            userPhone: instance.user?.phone ?? null,
            expireAt: instance.expireAt,
            applyScope: instance.template?.applyScope ?? null,
            stores: (instance.template?.stores ?? []).map((s) => ({ id: s.store.id, name: s.store.name })),
        };
        const store = ctx.store ? { id: ctx.store.id, name: ctx.store.name } : null;
        if (failure) {
            throw new biz_exception_1.BizException(failure.reasonCode, failure.message, httpStatusFor(failure.reasonCode), {
                redeemable: false,
                coupon,
                store,
                checks,
            });
        }
        return {
            redeemable: true,
            reasonCode: null,
            reason: null,
            coupon,
            store,
            discountAmount: ctx.discountAmount,
            checks,
        };
    }
    async redeem(dto, user, ip, ua) {
        const ctx = await this.resolveContext(dto, user);
        if (!ctx.instance) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.CODE_NOT_FOUND, `券码 ${dto.code} 不存在`);
        }
        const { failure } = await this.runChecks(ctx, dto);
        if (failure) {
            throw new biz_exception_1.BizException(failure.reasonCode, failure.message, httpStatusFor(failure.reasonCode));
        }
        const instance = ctx.instance;
        const store = ctx.store;
        const faceValue = Number(instance.template.faceValue);
        const totalAmount = dto.orderAmount ?? faceValue;
        const discountAmount = ctx.discountAmount;
        try {
            return await this.prisma.$transaction(async (tx) => {
                let orderId = null;
                const existing = await tx.order.findUnique({
                    where: { orderNo: dto.orderNo },
                    select: { id: true, userId: true, couponInstanceId: true },
                });
                if (existing) {
                    if (existing.userId !== instance.userId) {
                        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.COUPON_NOT_BELONG_TO_USER, `订单 ${dto.orderNo} 不属于该券的持有用户`);
                    }
                    if (existing.couponInstanceId && existing.couponInstanceId !== instance.id) {
                        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.ORDER_ALREADY_HAS_COUPON, `订单 ${dto.orderNo} 已使用其他代金券，同一订单只能用一张券`);
                    }
                    const bound = await tx.$executeRaw(client_1.Prisma.sql `UPDATE orders SET couponInstanceId = ${instance.id}, discountAmount = ${discountAmount}, payAmount = totalAmount - ${discountAmount}, updatedAt = NOW() WHERE id = ${existing.id} AND couponInstanceId IS NULL`);
                    if (bound === 0 && existing.couponInstanceId !== instance.id) {
                        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.ORDER_ALREADY_HAS_COUPON, `订单 ${dto.orderNo} 已使用其他代金券，同一订单只能用一张券`);
                    }
                    orderId = existing.id;
                }
                else {
                    const created = await tx.order.create({
                        data: {
                            orderNo: dto.orderNo,
                            userId: instance.userId,
                            merchantId: store.merchantId,
                            storeId: store.id,
                            orderType: client_1.OrderType.CONSUME,
                            totalAmount,
                            discountAmount,
                            payAmount: Number((totalAmount - discountAmount).toFixed(2)),
                            couponInstanceId: instance.id,
                            status: client_1.OrderStatus.NORMAL,
                            source: dto.orderSource ?? client_1.OrderSource.WEB,
                            consumeTime: new Date(),
                        },
                        select: { id: true },
                    });
                    orderId = created.id;
                }
                const flipped = await tx.$executeRaw(client_1.Prisma.sql `UPDATE coupon_instances SET status = 'USED', usedAt = NOW(), updatedAt = NOW() WHERE id = ${instance.id} AND status = 'UNUSED'`);
                if (flipped === 0) {
                    const current = await tx.couponInstance.findUnique({
                        where: { id: instance.id },
                        select: { status: true },
                    });
                    const status = current?.status ?? client_1.CouponInstanceStatus.USED;
                    const reasonCode = status === client_1.CouponInstanceStatus.FROZEN
                        ? biz_exception_1.ReasonCode.COUPON_FROZEN
                        : status === client_1.CouponInstanceStatus.EXPIRED
                            ? biz_exception_1.ReasonCode.COUPON_EXPIRED
                            : biz_exception_1.ReasonCode.COUPON_ALREADY_USED;
                    throw biz_exception_1.BizException.conflict(reasonCode, `券 ${instance.code} 当前状态为 ${status}，不可核销`);
                }
                if (ctx.codeRowId) {
                    await tx.$executeRaw(client_1.Prisma.sql `UPDATE coupon_codes SET status = 'REDEEMED' WHERE id = ${ctx.codeRowId} AND status IN ('ISSUED')`);
                }
                await tx.$executeRaw(client_1.Prisma.sql `UPDATE coupon_templates SET usedCount = usedCount + 1, updatedAt = NOW() WHERE id = ${instance.templateId}`);
                const record = await tx.redemptionRecord.create({
                    data: {
                        couponInstanceId: instance.id,
                        code: instance.code ?? dto.code,
                        userId: instance.userId,
                        storeId: store.id,
                        merchantId: store.merchantId,
                        operatorId: user.sub,
                        templateId: instance.templateId,
                        faceValue,
                        discountAmount,
                        orderId,
                        channel: dto.channel ?? client_1.RedemptionChannel.MANUAL,
                        status: client_1.RedemptionStatus.SUCCESS,
                        redeemedAt: new Date(),
                    },
                });
                await this.audit.record({
                    operatorId: user.sub,
                    operatorType: user.userType,
                    operatorName: user.username,
                    module: 'redemption',
                    action: ACTION.redeem,
                    targetType: 'redemption_record',
                    targetId: record.id,
                    before: { instanceId: instance.id, status: client_1.CouponInstanceStatus.UNUSED },
                    after: {
                        redemptionId: record.id,
                        code: record.code,
                        instanceId: instance.id,
                        templateId: instance.templateId,
                        userId: instance.userId,
                        storeId: store.id,
                        merchantId: store.merchantId,
                        orderId,
                        orderNo: dto.orderNo,
                        faceValue,
                        discountAmount,
                        channel: record.channel,
                        remark: dto.remark?.trim() || null,
                    },
                    ip: ip ?? null,
                    userAgent: ua ?? null,
                }, tx);
                return record;
            });
        }
        catch (e) {
            throw this.translatePrismaConflict(e, instance.code ?? dto.code);
        }
    }
    async reverse(id, dto, user, ip, ua) {
        const record = await this.prisma.redemptionRecord.findUnique({
            where: { id },
            include: {
                couponInstance: {
                    include: { template: { select: { id: true, name: true, ownerMerchantId: true, creatorMerchantId: true } } },
                },
                store: { select: { id: true, merchantId: true, name: true } },
            },
        });
        if (!record) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `核销记录 #${id} 不存在`);
        }
        this.assertRecordVisible(record, user);
        if (record.status !== client_1.RedemptionStatus.SUCCESS) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.REDEMPTION_ALREADY_REVERSED, `核销记录 #${id} 当前状态为 ${record.status}，只有 SUCCESS 记录可以冲正`);
        }
        await this.assertReverseAllowed(record, user, id);
        const reason = dto.reason.trim();
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.redemptionRecord.update({
                where: { id },
                data: { status: client_1.RedemptionStatus.REVERSED, reverseReason: reason, reversedAt: new Date() },
            });
            await tx.$executeRaw(client_1.Prisma.sql `UPDATE coupon_instances SET status = 'UNUSED', usedAt = NULL, updatedAt = NOW() WHERE id = ${record.couponInstanceId} AND status = 'USED'`);
            await tx.$executeRaw(client_1.Prisma.sql `UPDATE coupon_codes SET status = 'ISSUED' WHERE instanceId = ${record.couponInstanceId} AND status = 'REDEEMED'`);
            await tx.$executeRaw(client_1.Prisma.sql `UPDATE coupon_templates SET usedCount = usedCount - 1, updatedAt = NOW() WHERE id = ${record.templateId} AND usedCount >= 1`);
            await tx.$executeRaw(client_1.Prisma.sql `UPDATE orders SET couponInstanceId = NULL, discountAmount = 0, payAmount = totalAmount, updatedAt = NOW() WHERE couponInstanceId = ${record.couponInstanceId}`);
            await this.audit.record({
                operatorId: user.sub,
                operatorType: user.userType,
                operatorName: user.username,
                module: 'redemption',
                action: ACTION.reverse,
                targetType: 'redemption_record',
                targetId: id,
                before: { status: record.status, code: record.code, orderId: record.orderId },
                after: { status: updated.status, reason, reversedAt: updated.reversedAt },
                ip: ip ?? null,
                userAgent: ua ?? null,
            }, tx);
            return {
                record: updated,
                couponStatus: client_1.CouponInstanceStatus.UNUSED,
                reason: updated.reverseReason,
            };
        });
    }
    async list(query, user) {
        const scope = await this.visibleWhere(user);
        if (query.merchantId && user.userType !== 'PLATFORM' && query.merchantId !== user.merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '只能查询自己商家的核销记录');
        }
        const where = {
            AND: [
                scope,
                ...(query.merchantId && user.userType === 'PLATFORM' ? [{ merchantId: query.merchantId }] : []),
                ...(query.storeId ? [{ storeId: query.storeId }] : []),
                ...(query.templateId ? [{ templateId: query.templateId }] : []),
                ...(query.userId ? [{ userId: query.userId }] : []),
                ...(query.status ? [{ status: query.status }] : []),
                ...(query.code ? [{ code: { contains: query.code } }] : []),
                ...(query.redeemedFrom || query.redeemedTo
                    ? [
                        {
                            redeemedAt: {
                                ...(query.redeemedFrom ? { gte: new Date(query.redeemedFrom) } : {}),
                                ...(query.redeemedTo ? { lte: new Date(query.redeemedTo) } : {}),
                            },
                        },
                    ]
                    : []),
            ],
        };
        const [rows, total, grouped] = await Promise.all([
            this.prisma.redemptionRecord.findMany({
                where,
                orderBy: [{ redeemedAt: 'desc' }, { id: 'desc' }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
                include: {
                    user: { select: { id: true, nickname: true, phone: true } },
                    store: { select: { id: true, name: true } },
                    template: { select: { id: true, name: true } },
                },
            }),
            this.prisma.redemptionRecord.count({ where }),
            this.prisma.redemptionRecord.groupBy({
                by: ['merchantId'],
                where,
                _count: { _all: true },
                _sum: { faceValue: true, discountAmount: true },
            }),
        ]);
        const orderIds = [...new Set(rows.map((r) => r.orderId).filter((v) => !!v))];
        const orders = orderIds.length
            ? await this.prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, orderNo: true } })
            : [];
        const orderMap = new Map(orders.map((o) => [o.id, o.orderNo]));
        const merchantIds = [...new Set(grouped.map((g) => g.merchantId).filter((v) => !!v))];
        const merchants = merchantIds.length
            ? await this.prisma.merchant.findMany({ where: { id: { in: merchantIds } }, select: { id: true, name: true } })
            : [];
        const nameMap = new Map(merchants.map((m) => [m.id, m.name]));
        return {
            list: rows.map((r) => ({
                id: r.id,
                code: r.code,
                instanceId: r.couponInstanceId,
                templateId: r.templateId,
                templateName: r.template?.name ?? null,
                userId: r.userId,
                userName: r.user?.nickname ?? null,
                userPhone: r.user?.phone ?? null,
                storeId: r.storeId,
                storeName: r.store?.name ?? null,
                merchantId: r.merchantId,
                merchantName: r.merchantId ? nameMap.get(r.merchantId) ?? null : null,
                faceValue: Number(r.faceValue),
                discountAmount: Number(r.discountAmount),
                orderId: r.orderId,
                orderNo: r.orderId ? orderMap.get(r.orderId) ?? null : null,
                channel: r.channel,
                status: r.status,
                reverseReason: r.reverseReason,
                reversedAt: r.reversedAt,
                redeemedAt: r.redeemedAt,
            })),
            total,
            page: query.page,
            pageSize: query.pageSize,
            summary: grouped.map((g) => ({
                merchantId: g.merchantId,
                merchantName: g.merchantId ? nameMap.get(g.merchantId) ?? null : null,
                count: g._count._all,
                faceValueTotal: Number(g._sum.faceValue ?? 0),
                discountTotal: Number(g._sum.discountAmount ?? 0),
            })),
        };
    }
    async resolveContext(dto, user) {
        const store = await this.resolveStore(dto.storeId, user);
        const codeRow = await this.prisma.couponCode.findUnique({
            where: { code: dto.code },
            select: { id: true, status: true, instanceId: true },
        });
        if (codeRow && (!codeRow.instanceId || codeRow.status === client_1.CouponCodeStatus.UNISSUED)) {
            throw new biz_exception_1.BizException(biz_exception_1.ReasonCode.CODE_NOT_ISSUED, `券码 ${dto.code} 尚未发放（${codeRow.status}），无法核销`, common_1.HttpStatus.CONFLICT, { redeemable: false, coupon: null, store: { id: store.id, name: store.name }, checks: [
                    { item: '券码存在', passed: true },
                    { item: '券码已发放', passed: false, reasonCode: biz_exception_1.ReasonCode.CODE_NOT_ISSUED },
                ] });
        }
        if (codeRow && codeRow.status === client_1.CouponCodeStatus.VOID) {
            throw new biz_exception_1.BizException(biz_exception_1.ReasonCode.CODE_NOT_ISSUED, `券码 ${dto.code} 已作废`, common_1.HttpStatus.CONFLICT, { redeemable: false });
        }
        const instance = codeRow?.instanceId
            ? await this.prisma.couponInstance.findUnique({
                where: { id: codeRow.instanceId },
                include: {
                    user: { select: { id: true, nickname: true, phone: true } },
                    template: {
                        select: {
                            id: true,
                            name: true,
                            faceValue: true,
                            thresholdAmount: true,
                            applyScope: true,
                            status: true,
                            ownerMerchantId: true,
                            creatorMerchantId: true,
                            stores: { select: { store: { select: { id: true, name: true } } } },
                        },
                    },
                },
            })
            : await this.prisma.couponInstance.findFirst({
                where: { code: dto.code },
                include: {
                    user: { select: { id: true, nickname: true, phone: true } },
                    template: {
                        select: {
                            id: true,
                            name: true,
                            faceValue: true,
                            thresholdAmount: true,
                            applyScope: true,
                            status: true,
                            ownerMerchantId: true,
                            creatorMerchantId: true,
                            stores: { select: { store: { select: { id: true, name: true } } } },
                        },
                    },
                },
            });
        const checks = [
            { item: '券码存在', passed: !!codeRow || !!instance, ...(codeRow || instance ? {} : { reasonCode: biz_exception_1.ReasonCode.CODE_NOT_FOUND }) },
        ];
        if (codeRow && !codeRow.instanceId) {
            checks.push({
                item: '券码已发放',
                passed: false,
                reasonCode: biz_exception_1.ReasonCode.CODE_NOT_ISSUED,
                message: `券码 ${dto.code} 尚未发放（${codeRow.status}）`,
            });
        }
        const threshold = Number(instance?.template?.thresholdAmount ?? 0);
        const faceValue = Number(instance?.template?.faceValue ?? 0);
        const discountAmount = Math.min(faceValue, dto.orderAmount ?? faceValue);
        return { store, codeRowId: codeRow?.id ?? null, codeRowStatus: codeRow?.status ?? null, instance, checks, threshold, faceValue, discountAmount };
    }
    async runChecks(ctx, dto) {
        const checks = [...ctx.checks];
        const instance = ctx.instance;
        const fail = (item, reasonCode, message) => {
            checks.push({ item, passed: false, reasonCode, message });
            return { failure: { reasonCode, message }, checks };
        };
        const pass = (item) => checks.push({ item, passed: true });
        if (ctx.codeRowStatus === client_1.CouponCodeStatus.UNISSUED) {
            return fail('券码已发放', biz_exception_1.ReasonCode.CODE_NOT_ISSUED, `券码 ${dto.code} 尚未发放，无法核销`);
        }
        if (ctx.codeRowStatus === client_1.CouponCodeStatus.VOID) {
            return fail('券码有效', biz_exception_1.ReasonCode.CODE_NOT_ISSUED, `券码 ${dto.code} 已作废`);
        }
        pass('券码已发放');
        if (instance.status === client_1.CouponInstanceStatus.USED) {
            return fail('券未使用', biz_exception_1.ReasonCode.COUPON_ALREADY_USED, `券 ${instance.code} 已被核销（${instance.usedAt}）`);
        }
        if (instance.status === client_1.CouponInstanceStatus.FROZEN) {
            return fail('券未冻结', biz_exception_1.ReasonCode.COUPON_FROZEN, `券 ${instance.code} 已被冻结，请先解冻`);
        }
        if (instance.status === client_1.CouponInstanceStatus.EXPIRED) {
            return fail('券未过期', biz_exception_1.ReasonCode.COUPON_EXPIRED, `券 ${instance.code} 已过期（${instance.expireAt}）`);
        }
        pass('券状态为未使用');
        if (instance.expireAt.getTime() <= Date.now()) {
            return fail('券未过期', biz_exception_1.ReasonCode.COUPON_EXPIRED, `券 ${instance.code} 已于 ${instance.expireAt} 过期`);
        }
        pass('在有效期内');
        if (instance.template.status !== client_1.CouponTemplateStatus.PUBLISHED) {
            return fail('券模板已上架', biz_exception_1.ReasonCode.TEMPLATE_NOT_AVAILABLE, `券模板「${instance.template.name}」当前状态为 ${instance.template.status}，不可核销`);
        }
        pass('券模板已上架');
        const store = ctx.store;
        pass(`门店归属（${store.name}）`);
        const scope = instance.template.applyScope;
        if (scope === client_1.ApplyScope.SPECIFIED_STORES) {
            const allowed = instance.template.stores.some((s) => s.store.id === store.id);
            if (!allowed) {
                return fail('门店在适用范围内', biz_exception_1.ReasonCode.STORE_NOT_IN_SCOPE, `券「${instance.template.name}」仅限 ${instance.template.stores.map((s) => s.store.name).join('、')} 使用，当前门店 ${store.name} 不在范围内`);
            }
            pass('门店在适用范围内');
        }
        else if (scope !== client_1.ApplyScope.ALL_STORES) {
            return fail('适用范围', biz_exception_1.ReasonCode.APPLY_SCOPE_UNSUPPORTED, `适用范围 ${scope} 暂未实现`);
        }
        else {
            pass('全部门店可用');
        }
        if (dto.userId && dto.userId !== instance.userId) {
            return fail('券属于当前用户', biz_exception_1.ReasonCode.COUPON_NOT_BELONG_TO_USER, `券 ${instance.code} 不属于用户 #${dto.userId}`);
        }
        if (dto.userId)
            pass('券属于当前用户');
        if (dto.orderAmount !== undefined && ctx.threshold > 0 && dto.orderAmount < ctx.threshold) {
            return fail('满足使用门槛', biz_exception_1.ReasonCode.THRESHOLD_NOT_MET, `订单金额 ${dto.orderAmount} 未达到门槛 ${ctx.threshold}`);
        }
        if (ctx.threshold > 0)
            pass(`满足使用门槛（满 ${ctx.threshold}）`);
        if (dto.orderNo) {
            const order = await this.prisma.order.findUnique({
                where: { orderNo: dto.orderNo },
                select: { id: true, couponInstanceId: true, userId: true },
            });
            if (order?.couponInstanceId && order.couponInstanceId !== instance.id) {
                return fail('订单未使用其他券', biz_exception_1.ReasonCode.ORDER_ALREADY_HAS_COUPON, `订单 ${dto.orderNo} 已使用其他代金券，同一订单只能用一张券`);
            }
            if (order && order.userId !== instance.userId) {
                return fail('订单归属', biz_exception_1.ReasonCode.COUPON_NOT_BELONG_TO_USER, `订单 ${dto.orderNo} 不属于该券的持有用户`);
            }
            if (order)
                pass('订单未使用其他券');
        }
        return { failure: null, checks };
    }
    async resolveStore(storeId, user) {
        if (user.userType === 'STORE') {
            const own = user.storeId;
            if (storeId && own && storeId !== own) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, `店员只能在本门店（#${own}）核销`);
            }
            const id = storeId ?? own;
            if (!id) {
                throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.STORE_REQUIRED, '当前账号未绑定门店，必须指定 storeId');
            }
            return this.loadStore(id);
        }
        const id = storeId;
        if (!id) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.STORE_REQUIRED, '必须指定核销门店 storeId');
        }
        const store = await this.loadStore(id);
        if (user.userType === 'PLATFORM')
            return store;
        const merchantId = user.merchantId;
        if (!merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '当前账号未绑定商家');
        }
        if (store.merchantId === merchantId)
            return store;
        const merchant = await this.prisma.merchant.findUnique({
            where: { id: merchantId },
            select: { type: true },
        });
        if (merchant?.type === client_1.MerchantType.MAIN) {
            const owner = await this.prisma.merchant.findUnique({
                where: { id: store.merchantId },
                select: { parentId: true },
            });
            if (owner?.parentId === merchantId)
                return store;
        }
        throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, `门店「${store.name}」不属于当前商家，不能在此核销`);
    }
    async loadStore(id) {
        const store = await this.prisma.store.findUnique({
            where: { id },
            select: { id: true, name: true, merchantId: true, status: true },
        });
        if (!store) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `门店 #${id} 不存在`);
        }
        return store;
    }
    async assertReverseAllowed(record, user, id) {
        if (user.userType === 'PLATFORM')
            return;
        if (user.userType === 'MERCHANT') {
            const merchantId = user.merchantId;
            if (!merchantId) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '当前账号未绑定商家');
            }
            const merchant = await this.prisma.merchant.findUnique({
                where: { id: merchantId },
                select: { type: true },
            });
            if (merchant?.type === client_1.MerchantType.MAIN)
                return;
            if (record.merchantId !== merchantId) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, `核销记录 #${id} 的门店不属于当前商家，跨店冲正需主体商家操作`);
            }
        }
        if (user.userType === 'STORE' && record.storeId !== user.storeId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, `核销记录 #${id} 不属于当前门店，跨店冲正需主体商家操作`);
        }
        const ageHours = Math.floor((Date.now() - new Date(record.redeemedAt).getTime()) / (60 * 60 * 1000));
        if (Date.now() - new Date(record.redeemedAt).getTime() > REVERSE_WINDOW_MS) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.REVERSE_WINDOW_EXPIRED, `核销记录 #${id} 核销于 ${ageHours} 小时前，已超过 24 小时冲正窗口，请联系主体商家操作`);
        }
    }
    async visibleWhere(user) {
        if (user.userType === 'PLATFORM')
            return {};
        if (user.userType === 'STORE') {
            if (!user.storeId) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '当前账号未绑定门店');
            }
            return { storeId: user.storeId };
        }
        const merchantId = user.merchantId;
        if (!merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '当前账号未绑定商家');
        }
        const merchant = await this.prisma.merchant.findUnique({
            where: { id: merchantId },
            select: { type: true },
        });
        if (merchant?.type === client_1.MerchantType.MAIN) {
            return {
                OR: [{ merchantId }, { template: { ownerMerchantId: merchantId } }],
            };
        }
        return { merchantId };
    }
    assertRecordVisible(record, user) {
        if (user.userType === 'PLATFORM')
            return;
        if (user.userType === 'STORE') {
            if (record.storeId !== user.storeId) {
                throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '核销记录不存在或不在你的可见范围内');
            }
            return;
        }
        const merchantId = user.merchantId;
        if (!merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '当前账号未绑定商家');
        }
        const visible = record.merchantId === merchantId ||
            record.couponInstance.template.ownerMerchantId === merchantId ||
            record.couponInstance.template.creatorMerchantId === merchantId;
        if (!visible) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '核销记录不存在或不在你的可见范围内');
        }
    }
    translatePrismaConflict(e, code) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            return biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.COUPON_ALREADY_USED, `券 ${code} 已存在成功的核销记录，不能重复核销`);
        }
        return e;
    }
};
exports.RedemptionService = RedemptionService;
exports.RedemptionService = RedemptionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], RedemptionService);
//# sourceMappingURL=redemption.service.js.map