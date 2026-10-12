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
exports.CouponInstanceService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const audit_service_1 = require("../audit-log/audit.service");
const authorization_service_1 = require("../authorization/authorization.service");
const coupon_template_service_1 = require("./coupon-template.service");
const ACTION = {
    issue: 'coupon:issue',
    freeze: 'coupon:freeze',
    unfreeze: 'coupon:unfreeze',
};
let CouponInstanceService = class CouponInstanceService {
    constructor(prisma, audit, templates, authorization) {
        this.prisma = prisma;
        this.audit = audit;
        this.templates = templates;
        this.authorization = authorization;
        this.logger = new common_1.Logger('CouponInstance');
    }
    async issue(dto, user, ip, ua) {
        const quantity = dto.quantity ?? 1;
        const merchantId = await this.resolveIssuerMerchant(dto, user);
        const target = await this.resolveUser(dto);
        const { template } = await this.assertIssuable(dto.templateId, merchantId);
        const now = new Date();
        const expireAt = this.computeExpireAt(template.validType, template.validEnd, template.validDays, now);
        const result = await this.prisma.$transaction(async (tx) => {
            const stockAffected = await tx.$executeRaw(client_1.Prisma.sql `UPDATE coupon_templates SET issuedCount = issuedCount + ${quantity}, updatedAt = NOW() WHERE id = ${dto.templateId} AND totalStock - issuedCount >= ${quantity}`);
            if (stockAffected === 0) {
                throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.STOCK_EXHAUSTED, `模板「${template.name}」库存不足：本次需 ${quantity} 张，剩余 ${Math.max(template.totalStock - template.issuedCount, 0)} 张`);
            }
            const codeRows = await tx.$queryRaw(client_1.Prisma.sql `SELECT id, code FROM coupon_codes WHERE templateId = ${dto.templateId} AND status = 'UNISSUED' ORDER BY id ASC LIMIT ${quantity} FOR UPDATE`);
            if (codeRows.length < quantity) {
                throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.CODE_POOL_EXHAUSTED, `券码池不足：本次需 ${quantity} 个，可用 ${codeRows.length} 个，请先预生成券码`);
            }
            const created = [];
            for (const row of codeRows) {
                const instance = await tx.couponInstance.create({
                    data: {
                        userId: target.id,
                        templateId: dto.templateId,
                        code: row.code,
                        issuerMerchantId: merchantId,
                        source: client_1.CouponSource.MERCHANT_ISSUE,
                        pointsCost: template.pointsCost,
                        status: client_1.CouponInstanceStatus.UNUSED,
                        obtainedAt: now,
                        expireAt,
                    },
                });
                const bound = await tx.$executeRaw(client_1.Prisma.sql `UPDATE coupon_codes SET status = 'ISSUED', instanceId = ${instance.id} WHERE id = ${row.id} AND status = 'UNISSUED'`);
                if (bound === 0) {
                    throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.CODE_POOL_EXHAUSTED, `券码 ${row.code} 已被占用，发放中止`);
                }
                created.push({ id: instance.id, code: row.code });
            }
            await this.audit.record({
                operatorId: user.sub,
                operatorType: user.userType,
                operatorName: user.username,
                module: 'coupon',
                action: ACTION.issue,
                targetType: 'coupon_instance',
                targetId: created[0]?.id ?? null,
                before: {
                    templateId: dto.templateId,
                    issuedCount: template.issuedCount,
                },
                after: {
                    templateId: dto.templateId,
                    templateName: template.name,
                    issuerMerchantId: merchantId,
                    userId: target.id,
                    quantity: created.length,
                    expireAt,
                    codes: created.map((c) => c.code),
                    remark: dto.remark?.trim() || null,
                },
                ip: ip ?? null,
                userAgent: ua ?? null,
            }, tx);
            return created;
        });
        const instances = await this.prisma.couponInstance.findMany({
            where: { id: { in: result.map((r) => r.id) } },
            include: {
                user: { select: { id: true, nickname: true, phone: true } },
                template: { select: { id: true, name: true } },
            },
        });
        return {
            issued: await this.withIssuerNames(instances),
            quantity: instances.length,
            expireAt,
        };
    }
    async freeze(id, dto, user, ip, ua) {
        const instance = await this.prisma.couponInstance.findUnique({
            where: { id },
            include: { template: { select: { id: true, name: true, ownerMerchantId: true, creatorMerchantId: true, ownerType: true, status: true } } },
        });
        if (!instance) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `券实例 #${id} 不存在`);
        }
        await this.assertInstanceVisible(instance, user);
        const frozen = dto.frozen;
        if (frozen && instance.status !== client_1.CouponInstanceStatus.UNUSED) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.COUPON_NOT_FREEZABLE, `只有未使用（UNUSED）的券可以冻结，当前状态为 ${instance.status}`);
        }
        if (!frozen && instance.status !== client_1.CouponInstanceStatus.FROZEN) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.COUPON_NOT_FREEZABLE, `只有已冻结（FROZEN）的券可以解冻，当前状态为 ${instance.status}`);
        }
        const before = { status: instance.status };
        const updated = await this.prisma.$transaction(async (tx) => {
            const row = await tx.couponInstance.update({
                where: { id },
                data: { status: frozen ? client_1.CouponInstanceStatus.FROZEN : client_1.CouponInstanceStatus.UNUSED },
                include: {
                    user: { select: { id: true, nickname: true, phone: true } },
                    template: { select: { id: true, name: true } },
                },
            });
            await this.audit.record({
                operatorId: user.sub,
                operatorType: user.userType,
                operatorName: user.username,
                module: 'coupon',
                action: frozen ? ACTION.freeze : ACTION.unfreeze,
                targetType: 'coupon_instance',
                targetId: id,
                before,
                after: { status: row.status, reason: dto.reason?.trim() || null },
                ip: ip ?? null,
                userAgent: ua ?? null,
            }, tx);
            return row;
        });
        return { instance: (await this.withIssuerNames([updated]))[0] };
    }
    async list(query, user) {
        const scope = await this.visibleWhere(user);
        if (query.issuerMerchantId) {
            if (user.userType !== 'PLATFORM' && query.issuerMerchantId !== user.merchantId) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '只能查询自己发放的券实例');
            }
        }
        const where = {
            AND: [
                scope,
                ...(query.issuerMerchantId && user.userType === 'PLATFORM'
                    ? [{ issuerMerchantId: query.issuerMerchantId }]
                    : []),
                ...(query.templateId ? [{ templateId: query.templateId }] : []),
                ...(query.userId ? [{ userId: query.userId }] : []),
                ...(query.status ? [{ status: query.status }] : []),
                ...(query.code ? [{ code: { contains: query.code } }] : []),
                ...(query.expireFrom || query.expireTo
                    ? [
                        {
                            expireAt: {
                                ...(query.expireFrom ? { gte: new Date(query.expireFrom) } : {}),
                                ...(query.expireTo ? { lte: new Date(query.expireTo) } : {}),
                            },
                        },
                    ]
                    : []),
            ],
        };
        const [rows, total] = await Promise.all([
            this.prisma.couponInstance.findMany({
                where,
                orderBy: [{ obtainedAt: 'desc' }, { id: 'desc' }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
                include: {
                    user: { select: { id: true, nickname: true, phone: true } },
                    template: { select: { id: true, name: true } },
                },
            }),
            this.prisma.couponInstance.count({ where }),
        ]);
        return {
            list: await this.withIssuerNames(rows),
            total,
            page: query.page,
            pageSize: query.pageSize,
        };
    }
    async detail(id, user) {
        const instance = await this.prisma.couponInstance.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, nickname: true, phone: true } },
                template: {
                    select: {
                        id: true,
                        name: true,
                        faceValue: true,
                        thresholdAmount: true,
                        applyScope: true,
                        ownerMerchantId: true,
                        creatorMerchantId: true,
                        ownerType: true,
                        status: true,
                        stores: { select: { store: { select: { id: true, name: true } } } },
                    },
                },
            },
        });
        if (!instance) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `券实例 #${id} 不存在`);
        }
        await this.assertInstanceVisible(instance, user);
        const redemptions = await this.prisma.redemptionRecord.findMany({
            where: { couponInstanceId: id },
            orderBy: [{ redeemedAt: 'desc' }, { id: 'desc' }],
            include: { store: { select: { id: true, name: true } } },
        });
        const orderIds = [...new Set(redemptions.map((r) => r.orderId).filter((v) => !!v))];
        const orders = orderIds.length
            ? await this.prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, orderNo: true } })
            : [];
        const orderMap = new Map(orders.map((o) => [o.id, o.orderNo]));
        const operatorIds = [...new Set(redemptions.map((r) => r.operatorId).filter((v) => !!v))];
        const operators = operatorIds.length
            ? await this.prisma.adminUser.findMany({ where: { id: { in: operatorIds } }, select: { id: true, realName: true, username: true } })
            : [];
        const operatorMap = new Map(operators.map((o) => [o.id, o.realName || o.username]));
        return {
            instance: {
                ...(await this.withIssuerNames([instance]))[0],
                faceValue: Number(instance.template.faceValue),
                thresholdAmount: Number(instance.template.thresholdAmount),
                applyScope: instance.template.applyScope,
                stores: instance.template.stores.map((s) => ({ id: s.store.id, name: s.store.name })),
                redemptions: redemptions.map((r) => ({
                    id: r.id,
                    code: r.code,
                    status: r.status,
                    channel: r.channel,
                    storeId: r.storeId,
                    storeName: r.store?.name ?? null,
                    operatorId: r.operatorId,
                    operatorName: r.operatorId ? operatorMap.get(r.operatorId) ?? null : null,
                    orderId: r.orderId,
                    orderNo: r.orderId ? orderMap.get(r.orderId) ?? null : null,
                    faceValue: Number(r.faceValue),
                    discountAmount: Number(r.discountAmount),
                    reverseReason: r.reverseReason,
                    reversedAt: r.reversedAt,
                    redeemedAt: r.redeemedAt,
                })),
            },
        };
    }
    async resolveIssuerMerchant(dto, user) {
        if (user.userType === 'PLATFORM') {
            const merchantId = dto.merchantId ?? user.merchantId;
            if (!merchantId) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '未指定发券商家');
            }
            return merchantId;
        }
        if (!user.merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '当前账号未绑定商家');
        }
        return user.merchantId;
    }
    async resolveUser(dto) {
        if (dto.userId) {
            const user = await this.prisma.user.findUnique({
                where: { id: dto.userId },
                select: { id: true, status: true },
            });
            if (!user) {
                throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `用户 #${dto.userId} 不存在`);
            }
            return user;
        }
        if (dto.phone) {
            const user = await this.prisma.user.findUnique({
                where: { phone: dto.phone },
                select: { id: true, status: true },
            });
            if (!user) {
                throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `手机号 ${dto.phone} 未注册`);
            }
            return user;
        }
        throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, 'userId 与 phone 必须传一个');
    }
    async assertIssuable(templateId, merchantId) {
        const template = await this.prisma.couponTemplate.findUnique({
            where: { id: templateId },
            select: {
                id: true,
                name: true,
                ownerMerchantId: true,
                creatorMerchantId: true,
                ownerType: true,
                status: true,
                validType: true,
                validEnd: true,
                validDays: true,
                totalStock: true,
                issuedCount: true,
                pointsCost: true,
            },
        });
        if (!template) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `券模板 #${templateId} 不存在`);
        }
        const merchant = await this.prisma.merchant.findUnique({
            where: { id: merchantId },
            select: { id: true, type: true },
        });
        if (!merchant) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `商家 #${merchantId} 不存在`);
        }
        if (merchant.type === client_1.MerchantType.SUB) {
            const checked = await this.authorization.checkAuthorization(merchantId, templateId);
            return { template: { ...template, ...checked.template } };
        }
        if (template.ownerMerchantId === merchantId || template.creatorMerchantId === merchantId) {
            if (template.status !== client_1.CouponTemplateStatus.PUBLISHED) {
                throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.TEMPLATE_NOT_AVAILABLE, `模板「${template.name}」当前状态为 ${template.status}，不可发放`);
            }
            return { template };
        }
        if (template.ownerType !== client_1.CouponOwnerType.MAIN_COUPON) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SUB_MERCHANT_CAN_ONLY_ISSUE_MAIN_COUPON, '只能发放主体商家代金券');
        }
        const checked = await this.authorization.checkAuthorization(merchantId, templateId);
        return { template: { ...template, ...checked.template } };
    }
    computeExpireAt(validType, validEnd, validDays, now) {
        if (validType === 'FIXED') {
            const end = validEnd ?? new Date(now.getTime() + validDays * 86400_000);
            return end.getTime() > now.getTime() ? end : now;
        }
        return new Date(now.getTime() + (validDays || 30) * 86400_000);
    }
    async visibleWhere(user) {
        if (user.userType === 'PLATFORM')
            return {};
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
                template: { OR: [{ ownerMerchantId: merchantId }, { creatorMerchantId: merchantId }] },
            };
        }
        return {
            OR: [
                { issuerMerchantId: merchantId },
                { template: { OR: [{ ownerMerchantId: merchantId }, { creatorMerchantId: merchantId }] } },
            ],
        };
    }
    async assertInstanceVisible(instance, user) {
        if (user.userType === 'PLATFORM')
            return;
        const merchantId = user.merchantId;
        if (!merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '当前账号未绑定商家');
        }
        const visible = instance.issuerMerchantId === merchantId ||
            instance.template.ownerMerchantId === merchantId ||
            instance.template.creatorMerchantId === merchantId;
        if (!visible) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '券实例不存在或不在你的可见范围内');
        }
    }
    async withIssuerNames(rows) {
        const ids = [...new Set(rows.map((r) => r.issuerMerchantId).filter((v) => !!v))];
        const names = new Map();
        if (ids.length) {
            const merchants = await this.prisma.merchant.findMany({
                where: { id: { in: ids } },
                select: { id: true, name: true },
            });
            merchants.forEach((m) => names.set(m.id, m.name));
        }
        return rows.map((row) => ({
            ...this.toView(row),
            issuerMerchantName: row.issuerMerchantId ? names.get(row.issuerMerchantId) ?? null : null,
        }));
    }
    toView(row) {
        return {
            id: row.id,
            userId: row.userId,
            userName: row.user?.nickname ?? null,
            userPhone: row.user?.phone ?? null,
            templateId: row.templateId,
            templateName: row.template?.name ?? null,
            code: row.code,
            issuerMerchantId: row.issuerMerchantId,
            issuerMerchantName: null,
            source: row.source,
            pointsCost: row.pointsCost,
            status: row.status,
            obtainedAt: row.obtainedAt,
            expireAt: row.expireAt,
            usedAt: row.usedAt,
            createdAt: row.createdAt,
        };
    }
};
exports.CouponInstanceService = CouponInstanceService;
exports.CouponInstanceService = CouponInstanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        coupon_template_service_1.CouponTemplateService,
        authorization_service_1.AuthorizationService])
], CouponInstanceService);
//# sourceMappingURL=coupon-instance.service.js.map