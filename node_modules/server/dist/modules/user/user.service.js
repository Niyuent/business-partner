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
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const audit_service_1 = require("../audit-log/audit.service");
let UserService = class UserService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
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
    scopeUserFilter(scope) {
        if (scope.merchantId === null)
            return {};
        return {
            orders: {
                some: {
                    merchantId: scope.merchantId,
                    ...(scope.storeId !== null ? { storeId: scope.storeId } : {}),
                },
            },
        };
    }
    async list(query, user) {
        const scope = await this.scope(user);
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const where = {
            AND: [
                this.scopeUserFilter(scope),
                query.phone ? { phone: { contains: query.phone } } : {},
                query.keyword
                    ? { OR: [{ phone: { contains: query.keyword } }, { nickname: { contains: query.keyword } }] }
                    : {},
                query.status ? { status: query.status } : {},
                query.registeredFrom || query.registeredTo
                    ? {
                        registeredAt: {
                            ...(query.registeredFrom ? { gte: new Date(query.registeredFrom) } : {}),
                            ...(query.registeredTo ? { lte: new Date(query.registeredTo) } : {}),
                        },
                    }
                    : {},
            ],
        };
        const [rows, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                orderBy: { id: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    id: true,
                    phone: true,
                    nickname: true,
                    avatar: true,
                    status: true,
                    registeredAt: true,
                    openid: true,
                    unionid: true,
                    pointAccount: { select: { balance: true, totalEarned: true, totalSpent: true } },
                    _count: { select: { orders: true, couponInstances: true, redemptions: true } },
                },
            }),
            this.prisma.user.count({ where }),
        ]);
        return {
            list: rows.map((u) => ({
                id: u.id,
                phone: u.phone,
                nickname: u.nickname,
                avatar: u.avatar,
                status: u.status,
                registeredAt: u.registeredAt,
                bound: !!u.openid,
                balance: u.pointAccount?.balance ?? 0,
                totalEarned: u.pointAccount?.totalEarned ?? 0,
                totalSpent: u.pointAccount?.totalSpent ?? 0,
                orderCount: u._count.orders,
                couponCount: u._count.couponInstances,
                redemptionCount: u._count.redemptions,
            })),
            total,
            page,
            pageSize,
        };
    }
    async detail(id, user) {
        const scope = await this.scope(user);
        const visible = await this.prisma.user.findFirst({
            where: { AND: [{ id }, this.scopeUserFilter(scope)] },
            select: { id: true },
        });
        if (!visible)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '用户不存在或不在可见范围内');
        const orderWhere = {
            userId: id,
            ...(scope.merchantId !== null ? { merchantId: scope.merchantId } : {}),
            ...(scope.storeId !== null ? { storeId: scope.storeId } : {}),
        };
        const couponWhere = {
            userId: id,
            ...(scope.merchantId !== null ? { issuerMerchantId: scope.merchantId } : {}),
        };
        const [profile, account, orders, coupons, redemptions] = await Promise.all([
            this.prisma.user.findUnique({
                where: { id },
                select: { id: true, phone: true, nickname: true, avatar: true, status: true, openid: true, unionid: true, registeredAt: true, createdAt: true },
            }),
            this.prisma.pointAccount.findUnique({
                where: { userId: id },
                select: { balance: true, totalEarned: true, totalSpent: true },
            }),
            this.prisma.order.findMany({
                where: orderWhere,
                orderBy: { id: 'desc' },
                take: 50,
                select: { id: true, orderNo: true, payAmount: true, status: true, consumeTime: true, merchantId: true, storeId: true },
            }),
            this.prisma.couponInstance.findMany({
                where: couponWhere,
                orderBy: { id: 'desc' },
                take: 50,
                select: { id: true, code: true, status: true, templateId: true, obtainedAt: true, expireAt: true, issuerMerchantId: true },
            }),
            this.prisma.redemptionRecord.findMany({
                where: {
                    userId: id,
                    ...(scope.merchantId !== null ? { merchantId: scope.merchantId } : {}),
                    ...(scope.storeId !== null ? { storeId: scope.storeId } : {}),
                },
                orderBy: { id: 'desc' },
                take: 50,
                select: { id: true, code: true, status: true, redeemedAt: true, merchantId: true, storeId: true },
            }),
        ]);
        const sourceIds = Array.from(new Set(orders.map((o) => o.merchantId)));
        const merchants = sourceIds.length
            ? await this.prisma.merchant.findMany({ where: { id: { in: sourceIds } }, select: { id: true, name: true, type: true } })
            : [];
        return {
            profile,
            account: account ?? { balance: 0, totalEarned: 0, totalSpent: 0 },
            coupons,
            orders,
            redemptions,
            sourceMerchants: merchants,
        };
    }
    async updateStatus(id, user, dto, ip, ua) {
        const scope = await this.scope(user);
        const target = await this.prisma.user.findFirst({
            where: { AND: [{ id }, this.scopeUserFilter(scope)] },
            select: { id: true, status: true },
        });
        if (!target)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '用户不存在或不在可见范围内');
        if (target.status === dto.status) {
            return { id, status: dto.status, unchanged: true };
        }
        const updated = await this.prisma.user.update({ where: { id }, data: { status: dto.status } });
        await this.audit.record({
            operatorId: user.sub,
            operatorType: user.userType,
            operatorName: user.username,
            module: 'user',
            action: dto.status === client_1.UserStatus.DISABLED ? 'user:disable' : 'user:enable',
            targetType: 'user',
            targetId: id,
            before: { status: target.status },
            after: { status: updated.status },
            ip,
            userAgent: ua,
        });
        return { id, status: updated.status, unchanged: false };
    }
    async bindPhone(id, user, dto, ip, ua) {
        const scope = await this.scope(user);
        const target = await this.prisma.user.findFirst({
            where: { AND: [{ id }, this.scopeUserFilter(scope)] },
            select: { id: true, phone: true },
        });
        if (!target)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '用户不存在或不在可见范围内');
        const occupied = await this.prisma.user.findUnique({ where: { phone: dto.phone }, select: { id: true } });
        if (occupied && occupied.id !== id) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.USER_PHONE_EXISTS, '该手机号已被其它用户占用');
        }
        if (target.phone === dto.phone) {
            return { id, phone: dto.phone, unchanged: true };
        }
        const updated = await this.prisma.user.update({ where: { id }, data: { phone: dto.phone } });
        await this.audit.record({
            operatorId: user.sub,
            operatorType: user.userType,
            operatorName: user.username,
            module: 'user',
            action: 'user:bind-phone',
            targetType: 'user',
            targetId: id,
            before: { phone: target.phone },
            after: { phone: updated.phone },
            ip,
            userAgent: ua,
        });
        return { id, phone: updated.phone, unchanged: false };
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], UserService);
//# sourceMappingURL=user.service.js.map