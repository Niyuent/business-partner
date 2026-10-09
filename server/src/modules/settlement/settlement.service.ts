import { Injectable, Logger } from '@nestjs/common';
import { MerchantType, Prisma, ReportStatus, ReportType } from '@prisma/client';
import { BizException, ReasonCode } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit-log/audit.service';
import { JwtPayload } from '../auth/jwt-payload';
import { ConfirmSettlementDto, GenerateSettlementDto, QuerySettlementsDto } from './dto/settlement.dto';

/** 对账单快照明细行（核销） */
export interface RedemptionSnap {
  id: number;
  code: string;
  userId: number;
  storeId: number | null;
  storeName: string | null;
  faceValue: number;
  discountAmount: number;
  redeemedAt: string;
}
export interface PurchaseSnap {
  id: number;
  purchaseNo: string;
  templateName: string | null;
  quantity: number;
  totalAmount: number;
  settleStatus: string;
  purchasedAt: string;
}
export interface SettlementDetail {
  redemptions: RedemptionSnap[];
  purchases: PurchaseSnap[];
}

/**
 * 对账账单（S4.2）
 *
 * 产品决策（MVP）：`settlement_amount = Σ（本期核销的券的 face_value）`，不含「新客占比调整系数」
 * （那是 v2 商业谈判后的规则，现在加是空转）。
 *
 * 快照：生成时把本期核销明细 + 采购明细落进 `detail`（Json），后续数据变化不影响已生成对账单。
 */
@Injectable()
export class SettlementService {
  private readonly logger = new Logger('Settlement');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- 生成

  /**
   * 生成对账单（周期 + 商家）。
   * 幂等：同 (merchantId, periodStart, periodEnd) 已存在且非 DISPUTED → 返回已存在（200，不重复创建）；
   * DISPUTED → 重新生成（状态回 GENERATED、刷新快照）。
   */
  async generate(dto: GenerateSettlementDto, user?: JwtPayload) {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (periodStart >= periodEnd) {
      throw BizException.badRequest(ReasonCode.SETTLEMENT_NOT_CONFIRMABLE, '周期开始必须早于结束');
    }

    const existing = await this.prisma.settlementReport.findFirst({
      where: { merchantId: dto.merchantId ?? null, periodStart, periodEnd },
    });

    // 幂等：已存在且非 DISPUTED → 直接返回
    if (existing && existing.status !== ReportStatus.DISPUTED) {
      return { ...(await this.shape(existing)), idempotent: true };
    }

    const snap = await this.snapshot(dto.merchantId ?? null, periodStart, periodEnd);

    const reportNo = this.reportNo(dto.merchantId ?? null, periodStart, periodEnd);
    if (existing) {
      // DISPUTED → 重新生成
      const updated = await this.prisma.settlementReport.update({
        where: { id: existing.id },
        data: {
          status: ReportStatus.GENERATED,
          totalCount: snap.totalCount,
          totalAmount: snap.totalAmount,
          detail: snap.detail as unknown as Prisma.InputJsonValue,
          generatedBy: user?.sub ?? null,
          generatedAt: new Date(),
          confirmedAt: null,
          // 重新生成视为一次全新核算，清掉上一轮异议原因，避免旧原因误导
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
        reportType: ReportType.REDEMPTION,
        totalCount: snap.totalCount,
        totalAmount: snap.totalAmount,
        status: ReportStatus.GENERATED,
        detail: snap.detail as unknown as Prisma.InputJsonValue,
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

  /** 快照：本期核销明细 + 采购明细（数据库聚合算总额，不应用层循环） */
  private async snapshot(merchantId: number | null, periodStart: Date, periodEnd: Date) {
    const redemptionWhere: Prisma.RedemptionRecordWhereInput = {
      status: 'SUCCESS',
      redeemedAt: { gte: periodStart, lte: periodEnd },
      ...(merchantId ? { merchantId } : {}),
    };
    const purchaseWhere: Prisma.PurchaseRecordWhereInput = {
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
      // 总额用数据库 _sum，避免 10000 条在应用层累加
      this.prisma.redemptionRecord.aggregate({
        where: redemptionWhere,
        _sum: { faceValue: true },
        _count: true,
      }),
    ]);

    const detail: SettlementDetail = {
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

  // ---------------------------------------------------------------- 查询

  async list(query: QuerySettlementsDto, user: JwtPayload) {
    const scope = await this.settlementScope(user);
    const where: Prisma.SettlementReportWhereInput = {
      AND: [
        scope,
        {
          ...(query.merchantId ? { merchantId: query.merchantId } : {}),
          ...(query.status ? { status: query.status as ReportStatus } : {}),
          // 账期筛选（后端完成，不再依赖前端拉全量过滤）
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

  async detail(id: number, user: JwtPayload) {
    const report = await this.prisma.settlementReport.findUnique({ where: { id } });
    if (!report) throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, `对账单 #${id} 不存在`);
    // 隔离：附属只能看自己的，越权 → 404（不泄露存在）
    await this.assertVisible(report, user);
    const summary = await this.shape(report);
    const detail = (report.detail as unknown as SettlementDetail | null) ?? { redemptions: [], purchases: [] };
    return { ...summary, redemptions: detail.redemptions, purchases: detail.purchases };
  }

  // ---------------------------------------------------------------- 确认 / 异议

  /** 状态机：只有 GENERATED 能 confirm/dispute；CONFIRMED 冻结；DISPUTED 必须先重新生成 */
  async confirm(id: number, dto: ConfirmSettlementDto, user: JwtPayload) {
    const report = await this.prisma.settlementReport.findUnique({ where: { id } });
    if (!report) throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, `对账单 #${id} 不存在`);
    await this.assertVisible(report, user);

    if (!dto.confirm && (!dto.disputeReason || dto.disputeReason.trim().length < 5)) {
      throw BizException.badRequest(ReasonCode.SETTLEMENT_DISPUTE_REASON_REQUIRED, '提异议必须填写原因（≥5 字符）');
    }

    const targetStatus = dto.confirm ? ReportStatus.CONFIRMED : ReportStatus.DISPUTED;
    // 注意：settlement_reports 表无 updatedAt/updated_at 列（schema 未定义），
    // 此前 SQL 里写了 updatedAt 导致 ERROR 1054 Unknown column → 所有确认/异议 500。
    // 条件更新同时充当并发闸门：只有 GENERATED 能变更，affected=0 即状态不合法。
    const affected = await this.prisma.$executeRaw(
      Prisma.sql`UPDATE settlement_reports SET status = ${targetStatus}, confirmedAt = ${dto.confirm ? new Date() : null}, disputeReason = ${dto.confirm ? null : (dto.disputeReason ?? null)} WHERE id = ${id} AND status = 'GENERATED'`,
    );
    if (affected === 0) {
      // 区分冻结 / 不可确认
      if (report.status === ReportStatus.CONFIRMED) {
        throw BizException.conflict(ReasonCode.SETTLEMENT_FROZEN, '对账单已确认冻结，不可再操作');
      }
      throw BizException.conflict(ReasonCode.SETTLEMENT_NOT_CONFIRMABLE, `当前状态 ${report.status}，只有 GENERATED 能确认/异议（DISPUTED 需先重新生成）`);
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

  // ---------------------------------------------------------------- 导出 CSV

  /** 导出核销明细 CSV（UTF-8 BOM + 引号转义） */
  async exportCsv(id: number, user: JwtPayload): Promise<string> {
    const report = await this.prisma.settlementReport.findUnique({ where: { id } });
    if (!report) throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, `对账单 #${id} 不存在`);
    await this.assertVisible(report, user);

    const detail = (report.detail as unknown as SettlementDetail | null) ?? { redemptions: [], purchases: [] };
    const header = ['券码', '用户', '核销时间', '门店', '面值', '抵扣金额'];
    const rows = detail.redemptions.map((r) => [r.code, String(r.userId), new Date(r.redeemedAt).toISOString(), r.storeName ?? '', String(r.faceValue), String(r.discountAmount)]);
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(esc).join(',')).join('\r\n');
    // UTF-8 BOM：Excel 打开中文不乱码
    return '\ufeff' + csv;
  }

  // ---------------------------------------------------------------- 内部工具

  private reportNo(merchantId: number | null, start: Date, end: Date) {
    const s = start.toISOString().slice(0, 10).replace(/-/g, '');
    const e = end.toISOString().slice(0, 10).replace(/-/g, '');
    return `SET-${merchantId ?? 'ALL'}-${s}-${e}`;
  }

  /** 对账单可见范围：平台/主体全量；附属只看自己 */
  private async settlementScope(user: JwtPayload): Promise<Prisma.SettlementReportWhereInput> {
    if (user.userType === 'PLATFORM') return {};
    if (user.userType === 'STORE') return { id: -1 };
    const merchantId = user.merchantId;
    if (!merchantId) return { id: -1 };
    const me = await this.prisma.merchant.findUnique({ where: { id: merchantId }, select: { type: true } });
    if (me?.type === MerchantType.MAIN) return {}; // 主体看全部
    return { merchantId }; // 附属只看自己
  }

  private async assertVisible(report: { merchantId: number | null }, user: JwtPayload) {
    if (user.userType === 'PLATFORM') return;
    if (user.userType === 'STORE') throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, `对账单不存在或无权查看`);
    const me = await this.prisma.merchant.findUnique({ where: { id: user.merchantId ?? -1 }, select: { type: true } });
    if (me?.type === MerchantType.MAIN) return;
    if (report.merchantId !== user.merchantId) {
      throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, `对账单不存在或无权查看`);
    }
  }

  private async shape(r: Prisma.SettlementReportGetPayload<{}>) {
    const merchantName = r.merchantId
      ? (await this.prisma.merchant.findUnique({ where: { id: r.merchantId }, select: { name: true } }))?.name ?? null
      : '全平台';
    const detail = (r.detail as unknown as SettlementDetail | null) ?? { redemptions: [], purchases: [] };
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
}
