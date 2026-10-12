import type { Response } from 'express';
import { JwtPayload } from '../auth/jwt-payload';
import { ReportKeyParamDto, ReportQueryDto } from './dto/report.dto';
import { ReportService } from './report.service';
export declare class ReportController {
    private readonly reports;
    constructor(reports: ReportService);
    merchantOnboarding(q: ReportQueryDto, user: JwtPayload): Promise<{
        summary: Record<string, number>;
        byStatus: {
            status: import(".prisma/client").$Enums.MerchantStatus;
            count: number;
        }[];
        monthly: {
            month: string;
            count: number;
        }[];
    }>;
    ordersSummary(q: ReportQueryDto, user: JwtPayload): Promise<{
        summary: {
            count: number;
            totalAmount: number;
            payAmount: number;
            discountAmount: number;
        };
        byStatus: {
            status: import(".prisma/client").$Enums.OrderStatus;
            count: number;
            payAmount: number;
        }[];
        byMerchant: {
            merchantId: number;
            merchantName: string;
            count: number;
            payAmount: number;
        }[];
        daily: {
            date: string;
            count: number;
            payAmount: number;
        }[];
    }>;
    couponSummary(q: ReportQueryDto, user: JwtPayload): Promise<{
        summary: {
            total: number;
            used: number;
            unused: number;
            frozen: number;
            expired: number;
            usedRate: number;
        };
        byStatus: {
            status: import(".prisma/client").$Enums.CouponInstanceStatus;
            count: number;
        }[];
        byTemplate: {
            templateId: number;
            templateName: string;
            count: number;
        }[];
    }>;
    pointsSummary(q: ReportQueryDto, user: JwtPayload): Promise<{
        summary: {
            count: number;
            net: number;
            earned: number;
            spent: number;
            expired: number;
            refunded: number;
            adjusted: number;
        };
        byType: {
            type: import(".prisma/client").$Enums.PointTxnType;
            count: number;
            amount: number;
        }[];
    }>;
    storeSettlement(q: ReportQueryDto, user: JwtPayload): Promise<{
        summary: {
            purchaseCount: number;
            purchaseAmount: number;
            redemptionCount: number;
            redemptionAmount: number;
        };
        bySettleStatus: {
            settleStatus: import(".prisma/client").$Enums.SettleStatus;
            count: number;
            totalAmount: number;
        }[];
        byMerchant: {
            diffAmount: number;
            purchaseAmount: number;
            purchaseCount: number;
            redemptionAmount: number;
            redemptionCount: number;
            merchantId: number;
            merchantName: string;
        }[];
    }>;
    authorizationLogs(q: ReportQueryDto, user: JwtPayload): Promise<{
        total: number;
        page: number;
        pageSize: number;
        byStatus: {
            status: import(".prisma/client").$Enums.AuthStatus;
            count: number;
        }[];
        list: {
            id: number;
            mainMerchantId: number;
            mainMerchantName: string;
            subMerchantId: number;
            subMerchantName: string;
            status: import(".prisma/client").$Enums.AuthStatus;
            templateScope: import(".prisma/client").$Enums.TemplateScope;
            templateNames: string[];
            grantedAt: Date;
            revokedAt: Date;
            revokeReason: string;
        }[];
    }>;
    export(param: ReportKeyParamDto, q: ReportQueryDto, user: JwtPayload, res: Response): Promise<string>;
}
