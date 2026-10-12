import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit-log/audit.service';
import { JwtPayload } from '../auth/jwt-payload';
import { ConfirmSettlementDto, GenerateSettlementDto, QuerySettlementsDto } from './dto/settlement.dto';
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
export declare class SettlementService {
    private readonly prisma;
    private readonly audit;
    private readonly logger;
    constructor(prisma: PrismaService, audit: AuditService);
    generate(dto: GenerateSettlementDto, user?: JwtPayload): Promise<{
        idempotent: boolean;
        id: number;
        reportNo: string;
        merchantId: number;
        merchantName: string;
        periodStart: Date;
        periodEnd: Date;
        status: import(".prisma/client").$Enums.ReportStatus;
        totalAmount: number;
        totalCount: number;
        disputeReason: string;
        redemptionCount: number;
        purchaseCount: number;
        generatedAt: Date;
        confirmedAt: Date;
    } | {
        idempotent: boolean;
        regenerated: boolean;
        id: number;
        reportNo: string;
        merchantId: number;
        merchantName: string;
        periodStart: Date;
        periodEnd: Date;
        status: import(".prisma/client").$Enums.ReportStatus;
        totalAmount: number;
        totalCount: number;
        disputeReason: string;
        redemptionCount: number;
        purchaseCount: number;
        generatedAt: Date;
        confirmedAt: Date;
    }>;
    private snapshot;
    list(query: QuerySettlementsDto, user: JwtPayload): Promise<{
        list: {
            id: number;
            reportNo: string;
            merchantId: number;
            merchantName: string;
            periodStart: Date;
            periodEnd: Date;
            status: import(".prisma/client").$Enums.ReportStatus;
            totalAmount: number;
            totalCount: number;
            disputeReason: string;
            redemptionCount: number;
            purchaseCount: number;
            generatedAt: Date;
            confirmedAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    detail(id: number, user: JwtPayload): Promise<{
        redemptions: RedemptionSnap[];
        purchases: PurchaseSnap[];
        id: number;
        reportNo: string;
        merchantId: number;
        merchantName: string;
        periodStart: Date;
        periodEnd: Date;
        status: import(".prisma/client").$Enums.ReportStatus;
        totalAmount: number;
        totalCount: number;
        disputeReason: string;
        redemptionCount: number;
        purchaseCount: number;
        generatedAt: Date;
        confirmedAt: Date;
    }>;
    confirm(id: number, dto: ConfirmSettlementDto, user: JwtPayload): Promise<{
        id: number;
        status: "CONFIRMED" | "DISPUTED";
    }>;
    exportCsv(id: number, user: JwtPayload): Promise<string>;
    private reportNo;
    private settlementScope;
    private assertVisible;
    private shape;
}
