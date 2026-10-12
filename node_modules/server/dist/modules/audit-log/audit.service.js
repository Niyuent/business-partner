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
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const SENSITIVE_KEY = /(password|passwd|pwd|secret|token|credential|authorization)/i;
let AuditService = class AuditService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger('Audit');
    }
    async list(query, user) {
        const visibility = await this.visibilityWhere(user);
        const createdAt = {};
        if (query.from)
            createdAt.gte = new Date(query.from);
        if (query.to)
            createdAt.lte = new Date(query.to);
        let operatorFilter = {};
        if (query.operatorId) {
            operatorFilter = { operatorId: query.operatorId };
        }
        else if (query.operatorKeyword) {
            const matched = await this.prisma.adminUser.findMany({
                where: {
                    OR: [
                        { username: { contains: query.operatorKeyword } },
                        { realName: { contains: query.operatorKeyword } },
                    ],
                },
                select: { id: true },
            });
            const ids = matched.map((m) => m.id);
            operatorFilter = {
                OR: [
                    { operatorId: { in: ids } },
                    { operatorName: { contains: query.operatorKeyword } },
                ],
            };
        }
        const where = {
            AND: [
                visibility,
                {
                    ...(query.module ? { module: query.module } : {}),
                    ...(query.action ? { action: query.action } : {}),
                    ...(query.targetType ? { targetType: query.targetType } : {}),
                    ...(query.targetId ? { targetId: query.targetId } : {}),
                    ...(query.result ? { result: query.result } : {}),
                    ...(query.from || query.to ? { createdAt } : {}),
                    ...operatorFilter,
                },
            ],
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
                module: r.module,
                action: r.action,
                result: r.result,
                targetType: r.targetType,
                targetId: r.targetId,
                operatorId: r.operatorId,
                operatorType: r.operatorType,
                operatorName: r.operatorName,
                ip: r.ip,
                hasDetail: !!(r.beforeData || r.afterData),
                createdAt: r.createdAt,
            })),
            total,
            page: query.page,
            pageSize: query.pageSize,
        };
    }
    async detail(id, user) {
        const visibility = await this.visibilityWhere(user);
        const row = await this.prisma.auditLog.findFirst({ where: { id, ...visibility } });
        if (!row) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '日志不存在或无权查看');
        }
        const operator = row.operatorId
            ? await this.prisma.adminUser.findUnique({
                where: { id: row.operatorId },
                select: { id: true, username: true, realName: true },
            })
            : null;
        return {
            id: row.id,
            module: row.module,
            action: row.action,
            result: row.result,
            targetType: row.targetType,
            targetId: row.targetId,
            operatorId: row.operatorId,
            operatorType: row.operatorType,
            operatorName: row.operatorName,
            operatorUsername: operator?.username ?? null,
            ip: row.ip,
            userAgent: row.userAgent,
            before: this.mask(row.beforeData),
            after: this.mask(row.afterData),
            createdAt: row.createdAt,
        };
    }
    async visibilityWhere(user) {
        if (user.userType === 'PLATFORM')
            return {};
        if (!user.merchantId)
            return { operatorId: user.sub };
        const merchants = await this.prisma.merchant.findMany({
            where: { OR: [{ id: user.merchantId }, { parentId: user.merchantId }] },
            select: { id: true },
        });
        const merchantIds = merchants.map((m) => m.id);
        const [operators, stores, authorizations] = await Promise.all([
            this.prisma.adminUser.findMany({
                where: { merchantId: { in: merchantIds } },
                select: { id: true },
            }),
            this.prisma.store.findMany({
                where: { merchantId: { in: merchantIds } },
                select: { id: true },
            }),
            this.prisma.merchantAuthorization.findMany({
                where: { OR: [{ mainMerchantId: { in: merchantIds } }, { subMerchantId: { in: merchantIds } }] },
                select: { id: true },
            }),
        ]);
        return {
            OR: [
                { operatorId: { in: operators.map((o) => o.id) } },
                { targetType: 'merchant', targetId: { in: merchantIds } },
                { targetType: 'store', targetId: { in: stores.map((s) => s.id) } },
                {
                    targetType: 'merchant_authorization',
                    targetId: { in: authorizations.map((a) => a.id) },
                },
            ],
        };
    }
    mask(data) {
        if (data === null || data === undefined)
            return null;
        if (Array.isArray(data))
            return data.map((item) => this.mask(item));
        if (typeof data !== 'object')
            return data;
        const out = {};
        for (const [key, value] of Object.entries(data)) {
            if (SENSITIVE_KEY.test(key)) {
                out[key] = '******';
            }
            else if (value && typeof value === 'object') {
                out[key] = this.mask(value);
            }
            else {
                out[key] = value;
            }
        }
        return out;
    }
    async record(input, tx) {
        try {
            const client = tx ?? this.prisma;
            return await client.auditLog.create({
                data: {
                    operatorId: input.operatorId ?? null,
                    operatorType: input.operatorType ?? null,
                    operatorName: input.operatorName ?? null,
                    module: input.module,
                    action: input.action,
                    targetType: input.targetType ?? null,
                    targetId: input.targetId ?? null,
                    beforeData: (input.before ?? undefined),
                    afterData: (input.after ?? undefined),
                    ip: input.ip ?? null,
                    userAgent: input.userAgent ?? null,
                    result: input.result ?? client_1.AuditResult.SUCCESS,
                },
            });
        }
        catch (e) {
            this.logger.error(`审计日志写入失败 module=${input.module} action=${input.action}: ${e.message}`);
            return null;
        }
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditService);
//# sourceMappingURL=audit.service.js.map