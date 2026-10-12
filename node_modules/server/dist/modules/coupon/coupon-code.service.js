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
exports.CouponCodeService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const audit_service_1 = require("../audit-log/audit.service");
const coupon_template_service_1 = require("./coupon-template.service");
const coupon_code_util_1 = require("./coupon-code.util");
const ACTION = { generate: 'coupon:code:generate' };
let CouponCodeService = class CouponCodeService {
    constructor(prisma, audit, templates) {
        this.prisma = prisma;
        this.audit = audit;
        this.templates = templates;
        this.logger = new common_1.Logger('CouponCode');
    }
    async generate(templateId, dto, user, ip, ua) {
        const template = await this.prisma.couponTemplate.findUnique({
            where: { id: templateId },
            select: {
                id: true,
                name: true,
                ownerMerchantId: true,
                creatorMerchantId: true,
                ownerType: true,
                status: true,
            },
        });
        if (!template) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `券模板 #${templateId} 不存在`);
        }
        await this.templates.assertVisible(template, user);
        await this.templates.assertOwnedByMyMain(template, user);
        const quantity = dto.quantity;
        const batchNo = dto.batchNo?.trim() || (await this.nextBatchNo(templateId));
        let created = [];
        let batchId = 0;
        await this.prisma.$transaction(async (tx) => {
            let batch;
            try {
                batch = await tx.couponCodeBatch.create({
                    data: {
                        batchNo,
                        templateId,
                        quantity,
                        remark: dto.remark?.trim() || null,
                        operatorId: user.sub,
                    },
                });
            }
            catch (e) {
                if (this.isUniqueViolation(e)) {
                    throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.BATCH_ALREADY_EXISTS, `批次号 ${batchNo} 已存在，不能重复生成`);
                }
                throw e;
            }
            batchId = batch.id;
            for (let attempt = 1; attempt <= 3; attempt++) {
                const codes = (0, coupon_code_util_1.generateCouponCodes)(quantity);
                try {
                    await tx.couponCode.createMany({
                        data: codes.map((code) => ({
                            code,
                            templateId,
                            batchNo,
                            batchId: batch.id,
                            status: client_1.CouponCodeStatus.UNISSUED,
                        })),
                    });
                    created = await tx.couponCode.findMany({
                        where: { batchId: batch.id },
                        select: { id: true, code: true },
                        orderBy: { id: 'asc' },
                    });
                    break;
                }
                catch (e) {
                    if (this.isUniqueViolation(e) && attempt < 3) {
                        this.logger.warn(`券码碰撞，重试第 ${attempt} 次（batchNo=${batchNo}）`);
                        continue;
                    }
                    throw e;
                }
            }
            await this.audit.record({
                operatorId: user.sub,
                operatorType: user.userType,
                operatorName: user.username,
                module: 'coupon',
                action: ACTION.generate,
                targetType: 'coupon_template',
                targetId: templateId,
                before: null,
                after: {
                    batchNo,
                    quantity,
                    templateName: template.name,
                    samples: created.slice(0, 3).map((c) => c.code),
                },
                ip: ip ?? null,
                userAgent: ua ?? null,
            }, tx);
        });
        return {
            batchNo,
            batchId,
            templateId,
            quantity: created.length,
            codes: created.map((c) => c.code),
        };
    }
    async list(templateId, query, user) {
        const template = await this.prisma.couponTemplate.findUnique({
            where: { id: templateId },
            select: { id: true, ownerMerchantId: true, creatorMerchantId: true, ownerType: true, status: true },
        });
        if (!template) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `券模板 #${templateId} 不存在`);
        }
        await this.templates.assertVisible(template, user);
        const where = {
            templateId,
            ...(query.status ? { status: query.status } : {}),
            ...(query.batchNo ? { batchNo: query.batchNo } : {}),
            ...(query.batchId ? { batchId: query.batchId } : {}),
            ...(query.code ? { code: { contains: query.code } } : {}),
        };
        const [rows, total] = await Promise.all([
            this.prisma.couponCode.findMany({
                where,
                orderBy: { id: 'desc' },
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            }),
            this.prisma.couponCode.count({ where }),
        ]);
        const [unused, issued, redeemed] = await Promise.all([
            this.prisma.couponCode.count({ where: { templateId, status: client_1.CouponCodeStatus.UNISSUED } }),
            this.prisma.couponCode.count({ where: { templateId, status: client_1.CouponCodeStatus.ISSUED } }),
            this.prisma.couponCode.count({ where: { templateId, status: client_1.CouponCodeStatus.REDEEMED } }),
        ]);
        const withCode = query.withCode !== false;
        return {
            list: rows.map((row) => ({
                id: row.id,
                code: withCode ? row.code : `${row.code.slice(0, 4)}****${row.code.slice(-2)}`,
                batchNo: row.batchNo,
                batchId: row.batchId,
                templateId: row.templateId,
                status: row.status,
                instanceId: row.instanceId,
                generatedAt: row.generatedAt,
            })),
            total,
            page: query.page,
            pageSize: query.pageSize,
            stats: { unused, issued, redeemed },
        };
    }
    async batches(templateId, user) {
        const template = await this.prisma.couponTemplate.findUnique({
            where: { id: templateId },
            select: { id: true, ownerMerchantId: true, creatorMerchantId: true, ownerType: true, status: true },
        });
        if (!template) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `券模板 #${templateId} 不存在`);
        }
        await this.templates.assertVisible(template, user);
        const rows = await this.prisma.couponCodeBatch.findMany({
            where: { templateId },
            orderBy: { id: 'desc' },
            include: { _count: { select: { codes: true } } },
        });
        const statusCount = await this.prisma.couponCode.groupBy({
            by: ['batchId', 'status'],
            where: { templateId, batchId: { not: null } },
            _count: { _all: true },
        });
        const statsMap = new Map();
        for (const row of statusCount) {
            if (row.batchId == null)
                continue;
            const item = statsMap.get(row.batchId) ?? {};
            item[row.status] = row._count._all;
            statsMap.set(row.batchId, item);
        }
        const operatorIds = [...new Set(rows.map((b) => b.operatorId).filter((v) => !!v))];
        const operators = operatorIds.length
            ? await this.prisma.adminUser.findMany({
                where: { id: { in: operatorIds } },
                select: { id: true, realName: true, username: true },
            })
            : [];
        const operatorMap = new Map(operators.map((o) => [o.id, o.realName || o.username]));
        return {
            list: rows.map((b) => {
                const stats = statsMap.get(b.id) ?? {};
                return {
                    id: b.id,
                    batchNo: b.batchNo,
                    templateId: b.templateId,
                    quantity: b.quantity,
                    actualCount: b._count.codes,
                    stats: {
                        UNISSUED: stats.UNISSUED ?? 0,
                        ISSUED: stats.ISSUED ?? 0,
                        REDEEMED: stats.REDEEMED ?? 0,
                        VOID: stats.VOID ?? 0,
                    },
                    remark: b.remark,
                    operatorId: b.operatorId,
                    operatorName: b.operatorId ? operatorMap.get(b.operatorId) ?? null : null,
                    createdAt: b.createdAt,
                };
            }),
        };
    }
    async nextBatchNo(templateId) {
        const now = new Date();
        const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const prefix = `${templateId}-${ymd}`;
        const count = await this.prisma.couponCodeBatch.count({
            where: { batchNo: { startsWith: prefix } },
        });
        return `${prefix}-${String(count + 1).padStart(3, '0')}`;
    }
    isUniqueViolation(e) {
        const code = e?.code;
        return code === 'P2002';
    }
};
exports.CouponCodeService = CouponCodeService;
exports.CouponCodeService = CouponCodeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        coupon_template_service_1.CouponTemplateService])
], CouponCodeService);
//# sourceMappingURL=coupon-code.service.js.map