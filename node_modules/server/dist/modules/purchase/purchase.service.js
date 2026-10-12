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
exports.PurchaseService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const audit_service_1 = require("../audit-log/audit.service");
let PurchaseService = class PurchaseService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(query, user) {
        const scope = await this.purchaseScope(user);
        const visibleSubIds = await this.visibleSubMerchantIds(user);
        if (query.subMerchantId && visibleSubIds && !visibleSubIds.includes(query.subMerchantId)) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '无权查看其他附属商家的采购记录');
        }
        const purchasedAt = {};
        if (query.from)
            purchasedAt.gte = new Date(`${query.from}T00:00:00.000Z`);
        if (query.to)
            purchasedAt.lte = new Date(`${query.to}T23:59:59.999Z`);
        const where = {
            AND: [
                scope,
                {
                    ...(query.subMerchantId ? { subMerchantId: query.subMerchantId } : {}),
                    ...(query.settleStatus ? { settleStatus: query.settleStatus } : {}),
                    ...(query.from || query.to ? { purchasedAt } : {}),
                },
            ],
        };
        const [rows, total] = await Promise.all([
            this.prisma.purchaseRecord.findMany({
                where,
                orderBy: [{ id: 'desc' }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
                include: {
                    template: { select: { id: true, name: true } },
                },
            }),
            this.prisma.purchaseRecord.count({ where }),
        ]);
        const merchantIds = [...new Set(rows.flatMap((r) => [r.mainMerchantId, r.subMerchantId]))];
        const merchants = merchantIds.length
            ? await this.prisma.merchant.findMany({ where: { id: { in: merchantIds } }, select: { id: true, name: true } })
            : [];
        const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));
        return {
            list: rows.map((r) => ({
                id: r.id,
                purchaseNo: r.purchaseNo,
                mainMerchantId: r.mainMerchantId,
                mainMerchantName: merchantMap.get(r.mainMerchantId) ?? null,
                subMerchantId: r.subMerchantId,
                subMerchantName: merchantMap.get(r.subMerchantId) ?? null,
                templateId: r.templateId,
                templateName: r.template?.name ?? null,
                quantity: r.quantity,
                unitPrice: Number(r.unitPrice),
                totalAmount: Number(r.totalAmount),
                settleStatus: r.settleStatus,
                settleRemark: r.settleRemark,
                purchasedAt: r.purchasedAt,
                createdAt: r.createdAt,
            })),
            total,
            page: query.page,
            pageSize: query.pageSize,
        };
    }
    async create(dto, user) {
        const { mainMerchantId, subMerchantId } = await this.resolveParties(dto, user);
        const totalAmount = dto.totalAmount ?? Math.round(Number(dto.unitPrice) * dto.quantity * 100) / 100;
        const template = await this.prisma.couponTemplate.findUnique({ where: { id: dto.templateId }, select: { id: true } });
        if (!template)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `券模板 #${dto.templateId} 不存在`);
        let record;
        let purchaseNo;
        let lastErr = null;
        for (let attempt = 1; attempt <= 5; attempt++) {
            purchaseNo = await this.nextPurchaseNo(mainMerchantId, subMerchantId);
            try {
                record = await this.prisma.purchaseRecord.create({
                    data: {
                        purchaseNo,
                        mainMerchantId,
                        subMerchantId,
                        templateId: dto.templateId,
                        quantity: dto.quantity,
                        unitPrice: dto.unitPrice,
                        totalAmount,
                        purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : new Date(),
                        operatorId: user.sub,
                    },
                });
                lastErr = null;
                break;
            }
            catch (e) {
                lastErr = e;
                if (e.code === 'P2002') {
                    continue;
                }
                throw e;
            }
        }
        if (!record) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.CONCURRENT_UPDATE, '采购单号并发冲突，已重试 5 次仍未成功，请稍后重试');
        }
        await this.audit.record({
            operatorId: user.sub,
            operatorType: user.userType,
            module: 'purchase',
            action: 'PURCHASE_CREATE',
            targetType: 'purchase_record',
            targetId: record.id,
            after: { purchaseNo, mainMerchantId, subMerchantId, totalAmount },
        });
        return { id: record.id, purchaseNo: record.purchaseNo, totalAmount: Number(record.totalAmount), settleStatus: record.settleStatus };
    }
    async settle(id, dto, user) {
        const record = await this.prisma.purchaseRecord.findUnique({ where: { id } });
        if (!record)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `采购记录 #${id} 不存在`);
        await this.assertSettleAllowed(record, user);
        const updated = await this.prisma.$transaction(async (tx) => {
            const affected = await tx.$executeRaw(client_1.Prisma.sql `UPDATE purchase_records SET settleStatus = 'SETTLED', settleRemark = ${dto.settleRemark ?? null}, updatedAt = NOW() WHERE id = ${id} AND settleStatus = 'UNSETTLED'`);
            if (affected === 0) {
                throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.CONCURRENT_UPDATE, '该采购记录已结算，不能重复结算');
            }
            return tx.purchaseRecord.findUnique({ where: { id } });
        });
        await this.audit.record({
            operatorId: user.sub,
            operatorType: user.userType,
            module: 'purchase',
            action: 'PURCHASE_SETTLE',
            targetType: 'purchase_record',
            targetId: id,
            before: { settleStatus: record.settleStatus },
            after: { settleStatus: updated?.settleStatus, settleRemark: dto.settleRemark ?? null },
        });
        return { id, settleStatus: updated?.settleStatus, settleRemark: dto.settleRemark ?? null };
    }
    async resolveParties(dto, user) {
        if (user.userType === 'PLATFORM') {
            if (!dto.mainMerchantId || !dto.subMerchantId) {
                throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.MERCHANT_ID_REQUIRED, '平台管理员新增采购必须指定 mainMerchantId 与 subMerchantId');
            }
            return { mainMerchantId: dto.mainMerchantId, subMerchantId: dto.subMerchantId };
        }
        if (user.userType === 'STORE') {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '门店账号无权新增采购记录');
        }
        const self = user.merchantId;
        if (!self)
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '账号未关联商家');
        const me = await this.prisma.merchant.findUnique({ where: { id: self }, select: { type: true } });
        if (me?.type === client_1.MerchantType.MAIN) {
            if (!dto.subMerchantId)
                throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.MERCHANT_ID_REQUIRED, '主体采购必须指定 subMerchantId');
            return { mainMerchantId: self, subMerchantId: dto.subMerchantId };
        }
        if (!dto.mainMerchantId)
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.MERCHANT_ID_REQUIRED, '附属录单必须指定 mainMerchantId');
        return { mainMerchantId: dto.mainMerchantId, subMerchantId: self };
    }
    async purchaseScope(user) {
        if (user.userType === 'PLATFORM')
            return {};
        if (user.userType === 'STORE')
            return { id: -1 };
        const merchantId = user.merchantId;
        if (!merchantId)
            return { id: -1 };
        const me = await this.prisma.merchant.findUnique({ where: { id: merchantId }, select: { type: true } });
        if (me?.type === client_1.MerchantType.MAIN) {
            return { OR: [{ mainMerchantId: merchantId }, { subMerchantId: merchantId }] };
        }
        return { subMerchantId: merchantId };
    }
    async visibleSubMerchantIds(user) {
        if (user.userType === 'PLATFORM')
            return null;
        const merchantId = user.merchantId;
        if (!merchantId)
            return [];
        const me = await this.prisma.merchant.findUnique({ where: { id: merchantId }, select: { type: true } });
        if (me?.type === client_1.MerchantType.MAIN)
            return null;
        return [merchantId];
    }
    async assertSettleAllowed(record, user) {
        if (user.userType === 'PLATFORM')
            return;
        const me = await this.prisma.merchant.findUnique({ where: { id: user.merchantId ?? -1 }, select: { type: true } });
        if (!me || me.type !== client_1.MerchantType.MAIN) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '采购结算权归主体商家');
        }
    }
    async nextPurchaseNo(mainMerchantId, subMerchantId) {
        const now = new Date();
        const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
        const prefix = `${mainMerchantId}-${subMerchantId}-${yyyymmdd}-`;
        const last = await this.prisma.purchaseRecord.findFirst({
            where: { purchaseNo: { startsWith: prefix } },
            orderBy: { id: 'desc' },
            select: { purchaseNo: true },
        });
        const seq = last ? parseInt(last.purchaseNo.split('-').pop(), 10) + 1 : 1;
        return `${prefix}${seq}`;
    }
};
exports.PurchaseService = PurchaseService;
exports.PurchaseService = PurchaseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], PurchaseService);
//# sourceMappingURL=purchase.service.js.map