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
exports.AuthorizationService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const client_2 = require("@prisma/client");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const audit_service_1 = require("../audit-log/audit.service");
const ACTION_GRANT = 'authorization:grant';
const ACTION_REVOKE = 'authorization:revoke';
let AuthorizationService = class AuthorizationService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
        this.logger = new common_1.Logger('Authorization');
    }
    async list(query, user) {
        const mainMerchantId = await this.resolveMainMerchantId(user);
        const where = {
            mainMerchantId,
            ...(query.subMerchantId ? { subMerchantId: query.subMerchantId } : {}),
            ...(query.status ? { status: query.status } : {}),
        };
        const [rows, total] = await Promise.all([
            this.prisma.merchantAuthorization.findMany({
                where,
                orderBy: { id: 'asc' },
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
                include: {
                    mainMerchant: { select: { id: true, name: true } },
                    subMerchant: { select: { id: true, name: true } },
                    templates: { select: { templateId: true } },
                },
            }),
            this.prisma.merchantAuthorization.count({ where }),
        ]);
        return {
            list: rows.map((r) => this.toView(r)),
            total,
            page: query.page,
            pageSize: query.pageSize,
        };
    }
    async availableTemplates(user) {
        const mainMerchantId = await this.resolveMainMerchantId(user);
        const templates = await this.prisma.couponTemplate.findMany({
            where: {
                ownerMerchantId: mainMerchantId,
                ownerType: client_2.CouponOwnerType.MAIN_COUPON,
                status: client_2.CouponTemplateStatus.PUBLISHED,
            },
            orderBy: { id: 'asc' },
            select: {
                id: true,
                name: true,
                couponType: true,
                faceValue: true,
                thresholdAmount: true,
                pointsCost: true,
                totalStock: true,
                issuedCount: true,
                validEnd: true,
            },
        });
        return { mainMerchantId, templates };
    }
    async logs(query, user) {
        const mainMerchantId = await this.resolveMainMerchantId(user, query.mainMerchantId);
        const [auths, operators] = await Promise.all([
            this.prisma.merchantAuthorization.findMany({
                where: { mainMerchantId },
                select: { id: true, subMerchantId: true },
            }),
            this.prisma.adminUser.findMany({
                where: { merchantId: mainMerchantId },
                select: { id: true },
            }),
        ]);
        const targetIds = query.subMerchantId
            ? auths.filter((a) => a.subMerchantId === query.subMerchantId).map((a) => a.id)
            : auths.map((a) => a.id);
        const operatorIds = operators.map((o) => o.id);
        const createdAt = {};
        if (query.from)
            createdAt.gte = new Date(query.from);
        if (query.to)
            createdAt.lte = new Date(query.to);
        const where = {
            module: 'authorization',
            ...(query.action ? { action: query.action } : {}),
            ...(query.from || query.to ? { createdAt } : {}),
            ...(query.subMerchantId
                ? { targetId: { in: targetIds } }
                : { OR: [{ targetId: { in: targetIds } }, { operatorId: { in: operatorIds } }] }),
        };
        const [rows, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            }),
            this.prisma.auditLog.count({ where }),
        ]);
        return {
            list: rows.map((r) => ({
                id: r.id,
                action: r.action,
                result: r.result,
                targetType: r.targetType,
                targetId: r.targetId,
                operatorId: r.operatorId,
                operatorType: r.operatorType,
                operatorName: r.operatorName,
                ip: r.ip,
                before: r.beforeData,
                after: r.afterData,
                createdAt: r.createdAt,
            })),
            total,
            page: query.page,
            pageSize: query.pageSize,
        };
    }
    async create(dto, user, ip, ua) {
        const auditBase = {
            operatorId: user.sub,
            operatorType: user.userType,
            operatorName: user.username,
            module: 'authorization',
            targetType: 'merchant_authorization',
            ip,
            userAgent: ua,
        };
        try {
            const mainMerchantId = await this.resolveMainMerchantId(user, dto.mainMerchantId);
            const sub = await this.assertOwnSub(mainMerchantId, dto.subMerchantId);
            const templateIds = await this.resolveTemplates(mainMerchantId, dto);
            const result = await this.prisma.$transaction(async (tx) => {
                const existing = await tx.merchantAuthorization.findUnique({
                    where: {
                        mainMerchantId_subMerchantId_authType: {
                            mainMerchantId,
                            subMerchantId: dto.subMerchantId,
                            authType: dto.authType,
                        },
                    },
                });
                let reactivated = false;
                let before = null;
                let auth;
                if (existing) {
                    if (existing.status === client_2.AuthStatus.ENABLED) {
                        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.AUTHORIZATION_EXISTS, `该商家已处于授权状态（授权 id=${existing.id}），如需调整范围请先关闭再重开`);
                    }
                    before = { status: existing.status, templateScope: existing.templateScope };
                    auth = await tx.merchantAuthorization.update({
                        where: { id: existing.id },
                        data: {
                            status: client_2.AuthStatus.ENABLED,
                            templateScope: dto.templateScope,
                            grantedBy: user.sub,
                            grantedAt: new Date(),
                            revokedBy: null,
                            revokedAt: null,
                            revokeReason: null,
                        },
                    });
                    reactivated = true;
                }
                else {
                    auth = await tx.merchantAuthorization.create({
                        data: {
                            mainMerchantId,
                            subMerchantId: dto.subMerchantId,
                            authType: dto.authType,
                            status: client_2.AuthStatus.ENABLED,
                            templateScope: dto.templateScope,
                            grantedBy: user.sub,
                            grantedAt: new Date(),
                        },
                    });
                }
                await tx.merchantAuthorizationTemplate.deleteMany({
                    where: { authorizationId: auth.id },
                });
                if (dto.templateScope === 'SPECIFIED') {
                    await tx.merchantAuthorizationTemplate.createMany({
                        data: templateIds.map((templateId) => ({ authorizationId: auth.id, templateId })),
                    });
                }
                await this.audit.record({
                    ...auditBase,
                    action: ACTION_GRANT,
                    targetId: auth.id,
                    before,
                    after: {
                        mainMerchantId,
                        subMerchantId: dto.subMerchantId,
                        subMerchantName: sub.name,
                        authType: auth.authType,
                        templateScope: auth.templateScope,
                        templateIds: dto.templateScope === 'SPECIFIED' ? templateIds : [],
                        reactivated,
                    },
                }, tx);
                return { auth, reactivated };
            });
            this.logger.log(`主体 ${mainMerchantId} 授权 ${dto.subMerchantId}（id=${result.auth.id}）范围=${dto.templateScope}${result.reactivated ? ' [重新启用]' : ''}`);
            return {
                authorization: await this.authorizationView(result.auth.id),
                reactivated: result.reactivated,
            };
        }
        catch (e) {
            if (this.isAuthUniqueViolation(e)) {
                await this.audit.record({
                    ...auditBase,
                    action: ACTION_GRANT,
                    targetId: dto.subMerchantId,
                    result: 'FAILED',
                    after: { reasonCode: biz_exception_1.ReasonCode.AUTHORIZATION_EXISTS, dto },
                });
                throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.AUTHORIZATION_EXISTS, '该授权已存在，请勿重复提交');
            }
            await this.audit.record({
                ...auditBase,
                action: ACTION_GRANT,
                targetId: dto.subMerchantId,
                result: 'FAILED',
                after: { reasonCode: this.reasonCodeOf(e), message: e.message, dto },
            });
            throw e;
        }
    }
    async disable(id, dto, user, ip, ua) {
        const auditBase = {
            operatorId: user.sub,
            operatorType: user.userType,
            operatorName: user.username,
            module: 'authorization',
            targetType: 'merchant_authorization',
            targetId: id,
            ip,
            userAgent: ua,
        };
        try {
            const mainMerchantId = await this.resolveMainMerchantId(user);
            const result = await this.prisma.$transaction(async (tx) => {
                const { count } = await tx.merchantAuthorization.updateMany({
                    where: { id, mainMerchantId, status: client_2.AuthStatus.ENABLED },
                    data: {
                        status: client_2.AuthStatus.DISABLED,
                        revokedBy: user.sub,
                        revokedAt: new Date(),
                        revokeReason: dto.revokeReason ?? null,
                    },
                });
                const auth = await tx.merchantAuthorization.findUnique({
                    where: { id },
                    include: {
                        mainMerchant: { select: { id: true, name: true } },
                        subMerchant: { select: { id: true, name: true } },
                        templates: { select: { templateId: true } },
                    },
                });
                if (!auth) {
                    throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '授权记录不存在');
                }
                if (auth.mainMerchantId !== mainMerchantId) {
                    throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '只能关闭本主体发出的授权');
                }
                const alreadyDisabled = count === 0;
                await this.audit.record({
                    ...auditBase,
                    action: ACTION_REVOKE,
                    before: { status: alreadyDisabled ? client_2.AuthStatus.DISABLED : client_2.AuthStatus.ENABLED },
                    after: {
                        status: auth.status,
                        subMerchantId: auth.subMerchantId,
                        subMerchantName: auth.subMerchant?.name ?? null,
                        revokeReason: auth.revokeReason,
                        noop: alreadyDisabled,
                    },
                }, tx);
                return { auth, alreadyDisabled };
            });
            this.logger.log(`关闭授权 id=${id} 操作人=${user.username}(id=${user.sub}) 原因=${dto.revokeReason ?? '未填写'}${result.alreadyDisabled ? ' [幂等重复]' : ''}`);
            return {
                authorization: this.toView(result.auth),
                alreadyDisabled: result.alreadyDisabled,
            };
        }
        catch (e) {
            await this.audit.record({
                ...auditBase,
                action: ACTION_REVOKE,
                result: 'FAILED',
                after: { reasonCode: this.reasonCodeOf(e), message: e.message },
            });
            throw e;
        }
    }
    async me(user, query) {
        const merchantId = user.merchantId;
        if (!merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '当前账号未绑定商家');
        }
        for (const v of [query.merchantId, query.subMerchantId]) {
            if (v != null && v !== merchantId) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '只能查询自己商家的授权信息');
            }
        }
        const merchant = await this.prisma.merchant.findUnique({
            where: { id: merchantId },
            select: { id: true, name: true, type: true, parentId: true },
        });
        if (!merchant) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '商家不存在');
        }
        if (query.mainMerchantId != null && query.mainMerchantId !== merchant.parentId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '只能查询自己所属主体的授权');
        }
        const rows = await this.prisma.merchantAuthorization.findMany({
            where: { subMerchantId: merchantId },
            orderBy: { id: 'asc' },
            include: {
                mainMerchant: { select: { id: true, name: true } },
                subMerchant: { select: { id: true, name: true } },
                templates: { select: { templateId: true } },
            },
        });
        const authorizations = rows.map((r) => this.toView(r));
        const active = authorizations.find((a) => a.status === client_2.AuthStatus.ENABLED && a.authType === client_2.AuthType.ISSUE_MAIN_COUPON);
        return {
            merchantId: merchant.id,
            merchantName: merchant.name,
            merchantType: merchant.type,
            canIssueMainCoupon: !!active,
            issueMainCoupon: active
                ? {
                    authorizationId: active.id,
                    mainMerchantId: active.mainMerchantId,
                    templateScope: active.templateScope,
                    allowsAllTemplates: active.templateScope === 'ALL',
                    templateIds: active.templateIds,
                    grantedAt: active.grantedAt,
                }
                : null,
            authorizations,
        };
    }
    async getEffectiveGrant(subMerchantId, mainMerchantId) {
        return this.prisma.merchantAuthorization.findFirst({
            where: {
                subMerchantId,
                status: client_2.AuthStatus.ENABLED,
                authType: client_2.AuthType.ISSUE_MAIN_COUPON,
                ...(mainMerchantId ? { mainMerchantId } : {}),
            },
            include: {
                mainMerchant: { select: { id: true, name: true } },
                templates: { select: { templateId: true } },
            },
        });
    }
    async checkAuthorization(subMerchantId, templateId) {
        const grant = await this.getEffectiveGrant(subMerchantId);
        if (!grant) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SUB_MERCHANT_NOT_AUTHORIZED, '该商家未获得发放主体商家代金券的授权');
        }
        const template = await this.prisma.couponTemplate.findUnique({ where: { id: templateId } });
        if (!template) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `券模板 ${templateId} 不存在`);
        }
        if (template.ownerType !== client_2.CouponOwnerType.MAIN_COUPON) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SUB_MERCHANT_CAN_ONLY_ISSUE_MAIN_COUPON, '附属商家只能发放主体商家代金券');
        }
        if (grant.templateScope === 'SPECIFIED' &&
            !grant.templates.some((t) => t.templateId === templateId)) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.TEMPLATE_NOT_IN_AUTHORIZED_SCOPE, `模板「${template.name}」不在该商家的授权范围内`);
        }
        if (template.status !== client_2.CouponTemplateStatus.PUBLISHED) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.TEMPLATE_NOT_AVAILABLE, `模板「${template.name}」当前状态为 ${template.status}，不可发放`);
        }
        return {
            authorizationId: grant.id,
            mainMerchantId: grant.mainMerchantId,
            templateScope: grant.templateScope,
            template,
        };
    }
    async resolveMainMerchantId(user, requested) {
        if (user.userType === 'PLATFORM') {
            if (requested)
                return requested;
            const main = await this.prisma.merchant.findFirst({
                where: { type: client_2.MerchantType.MAIN },
                select: { id: true },
            });
            if (!main) {
                throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '平台未配置主体商家');
            }
            return main.id;
        }
        if (!user.merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '当前账号未绑定商家');
        }
        if (requested && requested !== user.merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '无权以其他主体的身份查看/操作授权');
        }
        const merchant = await this.prisma.merchant.findUnique({
            where: { id: user.merchantId },
            select: { id: true, type: true },
        });
        if (!merchant || merchant.type !== client_2.MerchantType.MAIN) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.AUTHORIZATION_MAIN_INVALID, '只有主体商家可以管理授权');
        }
        return merchant.id;
    }
    async assertOwnSub(mainMerchantId, subMerchantId) {
        const sub = await this.prisma.merchant.findUnique({
            where: { id: subMerchantId },
            select: { id: true, name: true, type: true, parentId: true, status: true },
        });
        if (!sub) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '被授权的商家不存在');
        }
        if (sub.type !== client_2.MerchantType.SUB) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.AUTHORIZATION_NOT_SUB, '只能给附属商家授权');
        }
        if (sub.parentId !== mainMerchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.AUTHORIZATION_NOT_CHILD, '该商家不是本主体的下属商家，无权为其授权');
        }
        if (sub.status !== 'APPROVED') {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.MERCHANT_NOT_ACTIVE, `该商家当前状态为 ${sub.status}，不可授权`);
        }
        return sub;
    }
    async resolveTemplates(mainMerchantId, dto) {
        if (dto.templateScope !== 'SPECIFIED')
            return [];
        const ids = dto.templateIds ?? [];
        if (ids.length === 0) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.TEMPLATE_SCOPE_REQUIRED, 'templateScope=SPECIFIED 时必须指定 templateIds');
        }
        const templates = await this.prisma.couponTemplate.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, ownerType: true, ownerMerchantId: true, status: true },
        });
        const map = new Map(templates.map((t) => [t.id, t]));
        for (const id of ids) {
            const t = map.get(id);
            if (!t) {
                throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `券模板 ${id} 不存在`);
            }
            if (t.ownerType !== client_2.CouponOwnerType.MAIN_COUPON || t.ownerMerchantId !== mainMerchantId) {
                throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.TEMPLATE_NOT_MAIN_COUPON, `券模板「${t.name}」不是本主体的主体券，不可授权`);
            }
            if (t.status !== client_2.CouponTemplateStatus.PUBLISHED) {
                throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.TEMPLATE_NOT_AVAILABLE, `券模板「${t.name}」当前状态为 ${t.status}，不可授权`);
            }
        }
        return ids;
    }
    async authorizationView(id) {
        const row = await this.prisma.merchantAuthorization.findUniqueOrThrow({
            where: { id },
            include: {
                mainMerchant: { select: { id: true, name: true } },
                subMerchant: { select: { id: true, name: true } },
                templates: { select: { templateId: true } },
            },
        });
        return this.toView(row);
    }
    toView(row) {
        return {
            id: row.id,
            mainMerchantId: row.mainMerchantId,
            mainMerchantName: row.mainMerchant?.name ?? null,
            subMerchantId: row.subMerchantId,
            subMerchantName: row.subMerchant?.name ?? null,
            authType: row.authType,
            status: row.status,
            templateScope: row.templateScope,
            templateIds: (row.templates ?? []).map((t) => t.templateId),
            grantedBy: row.grantedBy,
            grantedAt: row.grantedAt,
            revokedBy: row.revokedBy,
            revokedAt: row.revokedAt,
            revokeReason: row.revokeReason,
        };
    }
    isAuthUniqueViolation(e) {
        if (!(e instanceof client_1.Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002')
            return false;
        const target = e.meta?.target;
        const s = Array.isArray(target) ? target.join(',') : String(target ?? '');
        return s.includes('merchant_authorizations') || s.includes('authType');
    }
    reasonCodeOf(e) {
        return e instanceof biz_exception_1.BizException ? e.reasonCode : 'INTERNAL_ERROR';
    }
};
exports.AuthorizationService = AuthorizationService;
exports.AuthorizationService = AuthorizationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], AuthorizationService);
//# sourceMappingURL=authorization.service.js.map