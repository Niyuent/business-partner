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
exports.SettlementService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const csv_util_1 = require("../../common/utils/csv.util");
const audit_service_1 = require("../audit-log/audit.service");
let SettlementService = class SettlementService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
        this.logger = new common_1.Logger('Settlement');
    }
    async generate(dto, user) {
        const periodStart = new Date(dto.periodStart);
        const periodEnd = new Date(dto.periodEnd);
        if (periodStart >= periodEnd) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.SETTLEMENT_NOT_CONFIRMABLE, '周期开始必须早于结束');
        }
        const existing = await this.prisma.settlementReport.findFirst({
            where: { merchantId: dto.merchantId ?? null, periodStart, periodEnd },
        });
        if (existing && existing.status !== client_1.ReportStatus.DISPUTED) {
            return { ...(await this.shape(existing)), idempotent: true };
        }
        const snap = await this.snapshot(dto.merchantId ?? null, periodStart, periodEnd);
        const reportNo = this.reportNo(dto.merchantId ?? null, periodStart, periodEnd);
        if (existing) {
            const updated = await this.prisma.settlementReport.update({
                where: { id: existing.id },
                data: {
                    status: client_1.ReportStatus.GENERATED,
                    totalCount: snap.totalCount,
                    totalAmount: snap.totalAmount,
                    detail: snap.detail,
                    generatedBy: user?.sub ?? null,
                    generatedAt: new Date(),
                    confirmedAt: null,
                    disputeReason: null,
                },
            });
            await this.audit.record({
                operatorId: user?.sub ?? null,
                operatorType: user?.userType,
                module: 'settlement',
                action: 'SETTLEMENT_REGENERATE',
                targetType: 'settlement_report',
                targetId: updated.id,
                after: { totalAmount: snap.totalAmount, totalCount: snap.totalCount },
            });
            return { ...(await this.shape(updated)), idempotent: false, regenerated: true };
        }
        const created = await this.prisma.settlementReport.create({
            data: {
                reportNo,
                periodStart,
                periodEnd,
                merchantId: dto.merchantId ?? null,
                reportType: client_1.ReportType.REDEMPTION,
                totalCount: snap.totalCount,
                totalAmount: snap.totalAmount,
                status: client_1.ReportStatus.GENERATED,
                detail: snap.detail,
                generatedBy: user?.sub ?? null,
            },
        });
        await this.audit.record({
            operatorId: user?.sub ?? null,
            operatorType: user?.userType,
            module: 'settlement',
            action: 'SETTLEMENT_GENERATE',
            targetType: 'settlement_report',
            targetId: created.id,
            after: { reportNo, merchantId: dto.merchantId ?? null, totalAmount: snap.totalAmount, totalCount: snap.totalCount },
        });
        return { ...(await this.shape(created)), idempotent: false };
    }
    async snapshot(merchantId, periodStart, periodEnd) {
        const redemptionWhere = {
            status: 'SUCCESS',
            redeemedAt: { gte: periodStart, lte: periodEnd },
            ...(merchantId ? { merchantId } : {}),
        };
        const purchaseWhere = {
            purchasedAt: { gte: periodStart, lte: periodEnd },
            ...(merchantId ? { subMerchantId: merchantId } : {}),
        };
        const [redemptions, purchases, agg] = await Promise.all([
            this.prisma.redemptionRecord.findMany({
                where: redemptionWhere,
                include: { store: { select: { name: true } } },
                orderBy: { redeemedAt: 'asc' },
            }),
            this.prisma.purchaseRecord.findMany({
                where: purchaseWhere,
                include: { template: { select: { name: true } } },
                orderBy: { id: 'asc' },
            }),
            this.prisma.redemptionRecord.aggregate({
                where: redemptionWhere,
                _sum: { faceValue: true },
                _count: true,
            }),
        ]);
        const detail = {
            redemptions: redemptions.map((r) => ({
                id: r.id,
                code: r.code,
                userId: r.userId,
                storeId: r.storeId,
                storeName: r.store?.name ?? null,
                faceValue: Number(r.faceValue),
                discountAmount: Number(r.discountAmount),
                redeemedAt: new Date(r.redeemedAt).toISOString(),
            })),
            purchases: purchases.map((p) => ({
                id: p.id,
                purchaseNo: p.purchaseNo,
                templateName: p.template?.name ?? null,
                quantity: p.quantity,
                totalAmount: Number(p.totalAmount),
                settleStatus: p.settleStatus,
                purchasedAt: new Date(p.purchasedAt).toISOString(),
            })),
        };
        return {
            detail,
            totalAmount: Number(agg._sum.faceValue ?? 0),
            totalCount: agg._count,
        };
    }
    async list(query, user) {
        const scope = await this.settlementScope(user);
        const where = {
            AND: [
                scope,
                {
                    ...(query.merchantId ? { merchantId: query.merchantId } : {}),
                    ...(query.status ? { status: query.status } : {}),
                    ...(query.periodStart ? { periodStart: { gte: new Date(query.periodStart) } } : {}),
                    ...(query.periodEnd ? { periodEnd: { lte: new Date(query.periodEnd) } } : {}),
                },
            ],
        };
        const [rows, total] = await Promise.all([
            this.prisma.settlementReport.findMany({
                where,
                orderBy: [{ id: 'desc' }],
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
            }),
            this.prisma.settlementReport.count({ where }),
        ]);
        const list = await Promise.all(rows.map((r) => this.shape(r)));
        return { list, total, page: query.page, pageSize: query.pageSize };
    }
    async detail(id, user) {
        const report = await this.prisma.settlementReport.findUnique({ where: { id } });
        if (!report)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `对账单 #${id} 不存在`);
        await this.assertVisible(report, user);
        const summary = await this.shape(report);
        const detail = report.detail ?? { redemptions: [], purchases: [] };
        return { ...summary, redemptions: detail.redemptions, purchases: detail.purchases };
    }
    async confirm(id, dto, user) {
        const report = await this.prisma.settlementReport.findUnique({ where: { id } });
        if (!report)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `对账单 #${id} 不存在`);
        await this.assertVisible(report, user);
        if (!dto.confirm && (!dto.disputeReason || dto.disputeReason.trim().length < 5)) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.SETTLEMENT_DISPUTE_REASON_REQUIRED, '提异议必须填写原因（≥5 字符）');
        }
        const targetStatus = dto.confirm ? client_1.ReportStatus.CONFIRMED : client_1.ReportStatus.DISPUTED;
        const affected = await this.prisma.settlementReport.updateMany({
            where: { id, status: client_1.ReportStatus.GENERATED },
            data: {
                status: targetStatus,
                confirmedAt: dto.confirm ? new Date() : null,
                disputeReason: dto.confirm ? null : dto.disputeReason ?? null,
            },
        });
        if (affected.count === 0) {
            if (report.status === client_1.ReportStatus.CONFIRMED) {
                throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.SETTLEMENT_FROZEN, '对账单已确认冻结，不可再操作');
            }
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.SETTLEMENT_NOT_CONFIRMABLE, `当前状态 ${report.status}，只有 GENERATED 能确认/异议（DISPUTED 需先重新生成）`);
        }
        await this.audit.record({
            operatorId: user.sub,
            operatorType: user.userType,
            module: 'settlement',
            action: dto.confirm ? 'SETTLEMENT_CONFIRM' : 'SETTLEMENT_DISPUTE',
            targetType: 'settlement_report',
            targetId: id,
            before: { status: report.status },
            after: { status: targetStatus, disputeReason: dto.disputeReason ?? null },
        });
        return { id, status: targetStatus };
    }
    async exportCsv(id, user) {
        const report = await this.prisma.settlementReport.findUnique({ where: { id } });
        if (!report)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `对账单 #${id} 不存在`);
        await this.assertVisible(report, user);
        const detail = report.detail ?? { redemptions: [], purchases: [] };
        const header = ['券码', '用户', '核销时间', '门店', '面值', '抵扣金额'];
        const rows = detail.redemptions.map((r) => [r.code, String(r.userId), new Date(r.redeemedAt).toISOString(), r.storeName ?? '', String(r.faceValue), String(r.discountAmount)]);
        return (0, csv_util_1.toCsv)(header, rows);
    }
    reportNo(merchantId, start, end) {
        const s = start.toISOString().slice(0, 10).replace(/-/g, '');
        const e = end.toISOString().slice(0, 10).replace(/-/g, '');
        return `SET-${merchantId ?? 'ALL'}-${s}-${e}`;
    }
    async settlementScope(user) {
        if (user.userType === 'PLATFORM')
            return {};
        if (user.userType === 'STORE')
            return { id: -1 };
        const merchantId = user.merchantId;
        if (!merchantId)
            return { id: -1 };
        const me = await this.prisma.merchant.findUnique({ where: { id: merchantId }, select: { type: true } });
        if (me?.type === client_1.MerchantType.MAIN)
            return {};
        return { merchantId };
    }
    async assertVisible(report, user) {
        if (user.userType === 'PLATFORM')
            return;
        if (user.userType === 'STORE')
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `对账单不存在或无权查看`);
        const me = await this.prisma.merchant.findUnique({ where: { id: user.merchantId ?? -1 }, select: { type: true } });
        if (me?.type === client_1.MerchantType.MAIN)
            return;
        if (report.merchantId !== user.merchantId) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, `对账单不存在或无权查看`);
        }
    }
    async shape(r) {
        const merchantName = r.merchantId
            ? (await this.prisma.merchant.findUnique({ where: { id: r.merchantId }, select: { name: true } }))?.name ?? null
            : '全平台';
        const detail = r.detail ?? { redemptions: [], purchases: [] };
        return {
            id: r.id,
            reportNo: r.reportNo,
            merchantId: r.merchantId,
            merchantName,
            periodStart: r.periodStart,
            periodEnd: r.periodEnd,
            status: r.status,
            totalAmount: Number(r.totalAmount),
            totalCount: r.totalCount,
            disputeReason: r.disputeReason,
            redemptionCount: detail.redemptions.length,
            purchaseCount: detail.purchases.length,
            generatedAt: r.generatedAt,
            confirmedAt: r.confirmedAt,
        };
    }
};
exports.SettlementService = SettlementService;
exports.SettlementService = SettlementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], SettlementService);
//# sourceMappingURL=settlement.service.js.map