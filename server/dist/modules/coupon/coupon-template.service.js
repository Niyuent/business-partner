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
exports.CouponTemplateService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const audit_service_1 = require("../audit-log/audit.service");
const ACTION = {
    create: 'coupon:create',
    update: 'coupon:update',
    publish: 'coupon:publish',
    unpublish: 'coupon:unpublish',
};
let CouponTemplateService = class CouponTemplateService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
        this.logger = new common_1.Logger('CouponTemplate');
    }
    async list(query, user) {
        const { where, keyword } = await this.buildVisibleWhere(query, user);
        const whereFull = {
            ...where,
            ...(keyword ? { OR: [{ name: { contains: keyword } }, { subtitle: { contains: keyword } }] } : {}),
            ...(query.ownerType ? { ownerType: query.ownerType } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.ownerMerchantId ? { ownerMerchantId: query.ownerMerchantId } : {}),
        };
        const [rows, total] = await Promise.all([
            this.prisma.couponTemplate.findMany({
                where: whereFull,
                orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
                include: {
                    ownerMerchant: { select: { id: true, name: true } },
                    stores: { select: { store: { select: { id: true, name: true } } } },
                },
            }),
            this.prisma.couponTemplate.count({ where: whereFull }),
        ]);
        const realCount = await this.prisma.couponInstance.groupBy({
            by: ['templateId', 'status'],
            where: { templateId: { in: rows.map((r) => r.id) } },
            _count: { _all: true },
        });
        const statsMap = new Map();
        for (const row of realCount) {
            const item = statsMap.get(row.templateId) ?? { issued: 0, used: 0, unused: 0, frozen: 0, expired: 0 };
            item.issued += row._count._all;
            if (row.status === client_1.CouponInstanceStatus.USED)
                item.used += row._count._all;
            if (row.status === client_1.CouponInstanceStatus.UNUSED)
                item.unused += row._count._all;
            if (row.status === client_1.CouponInstanceStatus.FROZEN)
                item.frozen += row._count._all;
            if (row.status === client_1.CouponInstanceStatus.EXPIRED)
                item.expired += row._count._all;
            statsMap.set(row.templateId, item);
        }
        return {
            list: rows.map((row) => {
                const real = statsMap.get(row.id) ?? { issued: 0, used: 0, unused: 0, frozen: 0, expired: 0 };
                return {
                    ...this.toView(row),
                    instanceStats: {
                        issuedCount: real.issued,
                        usedCount: real.used,
                        unusedCount: real.unused,
                        frozenCount: real.frozen,
                        expiredCount: real.expired,
                        drift: {
                            issued: real.issued !== row.issuedCount,
                            used: real.used !== row.usedCount,
                        },
                    },
                };
            }),
            total,
            page: query.page,
            pageSize: query.pageSize,
        };
    }
    async detail(id, user) {
        const template = await this.prisma.couponTemplate.findUnique({
            where: { id },
            include: {
                ownerMerchant: { select: { id: true, name: true, code: true } },
                stores: { select: { store: { select: { id: true, name: true, merchantId: true } } } },
            },
        });
        if (!template) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `券模板 #${id} 不存在`);
        }
        await this.assertVisible(template, user);
        const [codes, instances] = await Promise.all([
            this.prisma.couponCode.groupBy({
                by: ['status'],
                where: { templateId: id },
                _count: { _all: true },
            }),
            this.prisma.couponInstance.groupBy({
                by: ['status'],
                where: { templateId: id },
                _count: { _all: true },
            }),
        ]);
        const toRecord = (rows) => rows.reduce((acc, r) => {
            acc[r.status] = r._count._all;
            return acc;
        }, {});
        return {
            ...this.toView(template),
            stats: {
                codes: toRecord(codes),
                instances: toRecord(instances),
            },
        };
    }
    async create(dto, user, ip, ua) {
        const main = await this.resolveMainMerchant(user, dto.mainMerchantId);
        const owner = await this.resolveOwner(dto.ownerType, dto.ownerMerchantId, main.id);
        const input = this.normalize(dto, { isUpdate: false });
        if (input.validType === 'FIXED' && input.validStart && input.validEnd) {
            this.assertValidPeriod(input.validStart, input.validEnd);
        }
        const storeIds = await this.assertStores(input.applyScope, dto.storeIds, owner.id);
        const data = {
            creatorMerchant: { connect: { id: main.id } },
            ownerMerchant: { connect: { id: owner.id } },
            ownerType: dto.ownerType ?? client_1.CouponOwnerType.MAIN_COUPON,
            name: dto.name.trim(),
            subtitle: dto.subtitle?.trim() || null,
            couponType: dto.couponType,
            faceValue: dto.faceValue,
            thresholdAmount: dto.thresholdAmount ?? 0,
            pointsCost: dto.pointsCost ?? 0,
            purchasePrice: dto.purchasePrice ?? 0,
            totalStock: dto.totalStock,
            validType: input.validType,
            validStart: input.validStart ?? null,
            validEnd: input.validEnd ?? null,
            validDays: input.validDays,
            applyScope: input.applyScope,
            perUserLimit: dto.perUserLimit ?? 1,
            status: client_1.CouponTemplateStatus.DRAFT,
            description: dto.description?.trim() || null,
            rules: dto.rules?.trim() || null,
            ...(storeIds.length ? { stores: { create: storeIds.map((storeId) => ({ storeId })) } } : {}),
        };
        const template = await this.prisma.$transaction(async (tx) => {
            const created = await tx.couponTemplate.create({
                data,
                include: {
                    ownerMerchant: { select: { id: true, name: true } },
                    stores: { select: { store: { select: { id: true, name: true } } } },
                },
            });
            await this.audit.record({
                operatorId: user.sub,
                operatorType: user.userType,
                operatorName: user.username,
                module: 'coupon',
                action: ACTION.create,
                targetType: 'coupon_template',
                targetId: created.id,
                before: null,
                after: this.snapshot(created, storeIds),
                ip: ip ?? null,
                userAgent: ua ?? null,
            }, tx);
            return created;
        });
        return { template: this.toView(template) };
    }
    async update(id, dto, user, ip, ua) {
        const template = await this.prisma.couponTemplate.findUnique({
            where: { id },
            include: { stores: { select: { storeId: true } } },
        });
        if (!template) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `券模板 #${id} 不存在`);
        }
        await this.assertOwnedByMyMain(template, user);
        this.assertEditable(template.status);
        const merged = this.merge(template, dto);
        if (merged.validType === 'FIXED') {
            this.assertValidPeriod(merged.validStart, merged.validEnd);
        }
        const nextTotalStock = dto.totalStock ?? template.totalStock;
        if (nextTotalStock < template.issuedCount) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.STOCK_BELOW_ISSUED, `发行总量不能小于已发放数量（当前已发放 ${template.issuedCount} 张）`);
        }
        const storeIds = await this.assertStores(merged.applyScope, dto.storeIds, template.ownerMerchantId);
        const data = {
            name: dto.name?.trim(),
            subtitle: dto.subtitle === undefined ? undefined : dto.subtitle.trim() || null,
            faceValue: dto.faceValue,
            thresholdAmount: dto.thresholdAmount,
            pointsCost: dto.pointsCost,
            purchasePrice: dto.purchasePrice,
            totalStock: dto.totalStock,
            validType: merged.validType,
            validStart: merged.validType === 'FIXED' ? merged.validStart : null,
            validEnd: merged.validType === 'FIXED' ? merged.validEnd : null,
            validDays: merged.validDays,
            applyScope: merged.applyScope,
            perUserLimit: dto.perUserLimit,
            description: dto.description === undefined ? undefined : dto.description.trim() || null,
            rules: dto.rules === undefined ? undefined : dto.rules.trim() || null,
            ...(dto.applyScope !== undefined
                ? {
                    stores: {
                        deleteMany: {},
                        ...(storeIds.length ? { create: storeIds.map((storeId) => ({ storeId })) } : {}),
                    },
                }
                : {}),
        };
        const before = this.snapshot(template, template.stores.map((s) => s.storeId));
        const updated = await this.prisma.$transaction(async (tx) => {
            const row = await tx.couponTemplate.update({
                where: { id },
                data,
                include: {
                    ownerMerchant: { select: { id: true, name: true } },
                    stores: { select: { store: { select: { id: true, name: true } } } },
                },
            });
            await this.audit.record({
                operatorId: user.sub,
                operatorType: user.userType,
                operatorName: user.username,
                module: 'coupon',
                action: ACTION.update,
                targetType: 'coupon_template',
                targetId: id,
                before,
                after: this.snapshot(row, storeIds.length ? storeIds : template.stores.map((s) => s.storeId)),
                ip: ip ?? null,
                userAgent: ua ?? null,
            }, tx);
            return row;
        });
        return { template: this.toView(updated) };
    }
    async publish(id, user, ip, ua) {
        return this.changeStatus(id, client_1.CouponTemplateStatus.PUBLISHED, user, ip, ua);
    }
    async unpublish(id, user, ip, ua) {
        return this.changeStatus(id, client_1.CouponTemplateStatus.UNPUBLISHED, user, ip, ua);
    }
    async changeStatus(id, target, user, ip, ua) {
        const template = await this.prisma.couponTemplate.findUnique({
            where: { id },
            include: { stores: { select: { storeId: true } } },
        });
        if (!template) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `券模板 #${id} 不存在`);
        }
        await this.assertOwnedByMyMain(template, user);
        const publishing = target === 'PUBLISHED';
        if (publishing && template.status === client_1.CouponTemplateStatus.PUBLISHED) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.TEMPLATE_ALREADY_PUBLISHED, '该券模板已处于上架状态');
        }
        if (!publishing && template.status !== client_1.CouponTemplateStatus.PUBLISHED) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.TEMPLATE_NOT_PUBLISHED, '只有已上架（PUBLISHED）的券模板才能下架');
        }
        if (template.status === client_1.CouponTemplateStatus.VOID) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.TEMPLATE_NOT_EDITABLE, '已作废的券模板不可再变更状态');
        }
        if (publishing) {
            if (template.totalStock <= 0) {
                throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.STOCK_NOT_ENOUGH, '发行总量必须大于 0 才能上架');
            }
            if (template.validType === 'FIXED' && template.validEnd && template.validEnd.getTime() < Date.now()) {
                throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.TEMPLATE_INVALID_VALID_PERIOD, '固定有效期的券模板已过期，请先调整有效期再上架');
            }
            if (template.applyScope === 'SPECIFIED_STORES' &&
                (template.stores?.length ?? 0) === 0) {
                throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.TEMPLATE_STORE_REQUIRED, '适用范围为指定门店时必须至少选择 1 家门店');
            }
        }
        const before = this.snapshot(template, template.stores.map((s) => s.storeId));
        const updated = await this.prisma.$transaction(async (tx) => {
            const row = await tx.couponTemplate.update({
                where: { id },
                data: { status: target },
                include: {
                    ownerMerchant: { select: { id: true, name: true } },
                    stores: { select: { store: { select: { id: true, name: true } } } },
                },
            });
            await this.audit.record({
                operatorId: user.sub,
                operatorType: user.userType,
                operatorName: user.username,
                module: 'coupon',
                action: publishing ? ACTION.publish : ACTION.unpublish,
                targetType: 'coupon_template',
                targetId: id,
                before,
                after: { status: target },
                ip: ip ?? null,
                userAgent: ua ?? null,
            }, tx);
            return row;
        });
        return { template: this.toView(updated) };
    }
    async resolveMainMerchant(user, requested) {
        const merchantId = user.userType === 'PLATFORM' ? (requested ?? user.merchantId) : user.merchantId;
        if (!merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '当前账号未绑定商家');
        }
        const merchant = await this.prisma.merchant.findUnique({
            where: { id: merchantId },
            select: { id: true, name: true, type: true, status: true },
        });
        if (!merchant) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `商家 #${merchantId} 不存在`);
        }
        if (merchant.type !== client_1.MerchantType.MAIN) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.COUPON_CREATOR_NOT_MAIN, '只有主体商家可以创建券模板');
        }
        if (merchant.status !== client_1.MerchantStatus.APPROVED) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.MERCHANT_NOT_ACTIVE, `主体商家「${merchant.name}」当前状态为 ${merchant.status}，不可创建券模板`);
        }
        return merchant;
    }
    async resolveOwner(ownerType, ownerMerchantId, mainId) {
        if (ownerType === 'MAIN_COUPON') {
            if (ownerMerchantId && ownerMerchantId !== mainId) {
                throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '主体券的归属商家必须是主体自身，不能指定为其它商家');
            }
            return { id: mainId };
        }
        if (!ownerMerchantId) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.MERCHANT_ID_REQUIRED, 'ownerType=SUB_COUPON 时必须传 ownerMerchantId');
        }
        const owner = await this.prisma.merchant.findUnique({
            where: { id: ownerMerchantId },
            select: { id: true, name: true, parentId: true, type: true, status: true },
        });
        if (!owner) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `商家 #${ownerMerchantId} 不存在`);
        }
        if (owner.type !== client_1.MerchantType.SUB || owner.parentId !== mainId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.OWNER_NOT_CHILD, '附属商家券的归属商家必须是本主体的直接下属');
        }
        if (owner.status !== client_1.MerchantStatus.APPROVED) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.MERCHANT_NOT_ACTIVE, `商家「${owner.name}」尚未通过审核，不能作为券归属`);
        }
        return owner;
    }
    async buildVisibleWhere(query, user) {
        const keyword = query.keyword?.trim();
        if (user.userType === 'PLATFORM') {
            return { where: {}, keyword };
        }
        const merchantId = user.merchantId;
        if (!merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '当前账号未绑定商家');
        }
        const merchant = await this.prisma.merchant.findUnique({
            where: { id: merchantId },
            select: { id: true, type: true },
        });
        if (!merchant) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '当前账号所属商家不存在');
        }
        if (merchant.type === client_1.MerchantType.MAIN) {
            if (query.ownerMerchantId && query.ownerMerchantId !== merchantId) {
                const owned = await this.prisma.couponTemplate.count({
                    where: { ownerMerchantId: query.ownerMerchantId, creatorMerchantId: merchantId },
                });
                if (owned === 0) {
                    throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '不能查看不属于本主体范围内的券模板');
                }
            }
            return {
                where: {
                    OR: [{ ownerMerchantId: merchantId }, { creatorMerchantId: merchantId }],
                },
                keyword,
            };
        }
        if (query.ownerMerchantId && query.ownerMerchantId !== merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '附属商家只能查看自己名下或被授权给自己的券模板');
        }
        const authorized = await this.authorizedCondition(merchantId);
        return {
            where: { OR: [{ ownerMerchantId: merchantId }, authorized] },
            keyword,
        };
    }
    async authorizedCondition(subMerchantId) {
        const auths = await this.prisma.merchantAuthorization.findMany({
            where: {
                subMerchantId,
                status: client_1.AuthStatus.ENABLED,
                authType: client_1.AuthType.ISSUE_MAIN_COUPON,
            },
            select: { templateScope: true, templates: { select: { templateId: true } } },
        });
        const base = {
            ownerType: client_1.CouponOwnerType.MAIN_COUPON,
            status: client_1.CouponTemplateStatus.PUBLISHED,
        };
        if (!auths.length) {
            return { ...base, id: -1 };
        }
        if (auths.some((a) => a.templateScope === 'ALL')) {
            return base;
        }
        const ids = auths.flatMap((a) => a.templates.map((t) => t.templateId));
        return { ...base, id: { in: ids.length ? ids : [-1] } };
    }
    async assertVisible(template, user) {
        if (user.userType === 'PLATFORM')
            return;
        const merchantId = user.merchantId;
        if (!merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '当前账号未绑定商家');
        }
        if (template.ownerMerchantId === merchantId || template.creatorMerchantId === merchantId)
            return;
        const authorized = await this.authorizedCondition(merchantId);
        const hit = await this.prisma.couponTemplate.count({
            where: { AND: [{ id: template.id }, authorized] },
        });
        if (hit === 0) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '券模板不存在或不在你的可见范围内');
        }
    }
    async assertOwnedByMyMain(template, user) {
        if (user.userType === 'PLATFORM')
            return;
        const merchantId = user.merchantId;
        if (!merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '当前账号未绑定商家');
        }
        if (template.creatorMerchantId === merchantId || template.ownerMerchantId === merchantId) {
            return;
        }
        throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '只能操作本主体创建或拥有的券模板');
    }
    assertEditable(status) {
        if (status === client_1.CouponTemplateStatus.PUBLISHED) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.TEMPLATE_NOT_EDITABLE, '已上架的券模板不可编辑，请先下架再修改');
        }
        if (status === client_1.CouponTemplateStatus.VOID) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.TEMPLATE_NOT_EDITABLE, '已作废的券模板不可编辑');
        }
    }
    assertValidPeriod(start, end) {
        if (!start || !end) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.TEMPLATE_INVALID_VALID_PERIOD, '固定有效期必须同时传 validStart 与 validEnd');
        }
        if (start.getTime() >= end.getTime()) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.TEMPLATE_INVALID_VALID_PERIOD, 'validEnd 必须晚于 validStart');
        }
    }
    normalize(dto, opts) {
        return this.buildValidity(dto.validType, dto.validStart, dto.validEnd, dto.validDays, dto.applyScope);
    }
    merge(template, dto) {
        return this.buildValidity(dto.validType ?? template.validType, dto.validStart ?? template.validStart?.toISOString(), dto.validEnd ?? template.validEnd?.toISOString(), dto.validDays ?? template.validDays, dto.applyScope ?? template.applyScope);
    }
    buildValidity(validType, validStart, validEnd, validDays, applyScope = 'ALL_STORES') {
        if (applyScope === 'SPECIFIED_MERCHANTS') {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.APPLY_SCOPE_UNSUPPORTED, '适用范围 SPECIFIED_MERCHANTS 尚未实现（S4 规划），请选择全部门店或指定门店');
        }
        if (validType === 'FIXED') {
            const start = validStart ? new Date(validStart) : null;
            const end = validEnd ? new Date(validEnd) : null;
            return { validType: 'FIXED', validStart: start, validEnd: end, validDays: 0, applyScope };
        }
        const days = validDays ?? 30;
        return {
            validType: 'AFTER_RECEIVE_DAYS',
            validStart: null,
            validEnd: null,
            validDays: days,
            applyScope,
        };
    }
    async assertStores(applyScope, storeIds, ownerMerchantId) {
        if (applyScope !== 'SPECIFIED_STORES') {
            if (storeIds?.length) {
                this.logger.warn(`applyScope=${applyScope} 时忽略 storeIds 参数`);
            }
            return [];
        }
        if (!storeIds?.length) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.TEMPLATE_STORE_REQUIRED, 'applyScope=SPECIFIED_STORES 时必须传 storeIds');
        }
        const stores = await this.prisma.store.findMany({
            where: { id: { in: storeIds } },
            select: { id: true, name: true, merchantId: true },
        });
        if (stores.length !== storeIds.length) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '存在不存在的门店 id');
        }
        const illegal = stores.filter((s) => s.merchantId !== ownerMerchantId);
        if (illegal.length) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, `门店 ${illegal.map((s) => s.name).join('、')} 不属于该券的归属商家`);
        }
        return storeIds;
    }
    toView(row) {
        const stores = (row.stores ?? []).map((s) => ({ id: s.store.id, name: s.store.name }));
        return {
            id: row.id,
            name: row.name,
            subtitle: row.subtitle,
            ownerType: row.ownerType,
            ownerMerchantId: row.ownerMerchantId,
            ownerMerchantName: row.ownerMerchant?.name ?? null,
            creatorMerchantId: row.creatorMerchantId,
            couponType: row.couponType,
            faceValue: Number(row.faceValue),
            thresholdAmount: Number(row.thresholdAmount),
            pointsCost: row.pointsCost,
            purchasePrice: Number(row.purchasePrice),
            totalStock: row.totalStock,
            issuedCount: row.issuedCount,
            usedCount: row.usedCount,
            remainingStock: Math.max(row.totalStock - row.issuedCount, 0),
            validType: row.validType,
            validStart: row.validStart,
            validEnd: row.validEnd,
            validDays: row.validDays,
            applyScope: row.applyScope,
            storeIds: stores.map((s) => s.id),
            stores,
            perUserLimit: row.perUserLimit,
            status: row.status,
            editable: row.status === 'DRAFT' || row.status === 'UNPUBLISHED',
            description: row.description,
            rules: row.rules,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
    snapshot(row, storeIds) {
        return {
            name: row.name,
            faceValue: Number(row.faceValue),
            thresholdAmount: Number(row.thresholdAmount),
            totalStock: row.totalStock,
            validType: row.validType,
            validStart: row.validStart,
            validEnd: row.validEnd,
            validDays: row.validDays,
            applyScope: row.applyScope,
            storeIds,
            perUserLimit: row.perUserLimit,
            status: row.status,
        };
    }
};
exports.CouponTemplateService = CouponTemplateService;
exports.CouponTemplateService = CouponTemplateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], CouponTemplateService);
//# sourceMappingURL=coupon-template.service.js.map