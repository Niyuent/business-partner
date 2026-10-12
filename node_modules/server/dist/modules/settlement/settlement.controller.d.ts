import type { Response } from 'express';
import { JwtPayload } from '../auth/jwt-payload';
import { ConfirmSettlementDto, GenerateSettlementDto, QuerySettlementsDto } from './dto/settlement.dto';
import { SettlementService } from './settlement.service';
export declare class SettlementController {
    private readonly settlements;
    constructor(settlements: SettlementService);
    generate(dto: GenerateSettlementDto, user: JwtPayload, res: Response): Promise<{
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
        redemptions: import("./settlement.service").RedemptionSnap[];
        purchases: import("./settlement.service").PurchaseSnap[];
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
    export(id: number, user: JwtPayload, res: Response): Promise<string>;
}
