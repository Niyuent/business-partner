import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload';
import { NotificationService } from '../notification/notification.service';
import { ReportKey, ReportQueryDto, TrendQueryDto } from './dto/report.dto';
export declare class ReportService {
    private readonly prisma;
    private readonly notifications;
    private readonly logger;
    constructor(prisma: PrismaService, notifications: NotificationService);
    private scope;
    private range;
    private hasRange;
    private merchantNames;
    merchantOnboarding(dto: ReportQueryDto, user: JwtPayload): Promise<{
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
    ordersSummary(dto: ReportQueryDto, user: JwtPayload): Promise<{
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
    couponSummary(dto: ReportQueryDto, user: JwtPayload): Promise<{
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
    pointsSummary(dto: ReportQueryDto, user: JwtPayload): Promise<{
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
    storeSettlement(dto: ReportQueryDto, user: JwtPayload): Promise<{
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
    authorizationLogs(dto: ReportQueryDto, user: JwtPayload): Promise<{
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
    exportCsv(key: ReportKey, dto: ReportQueryDto, user: JwtPayload): Promise<string>;
    private ymd;
    private statsCards;
    stats(user: JwtPayload): Promise<{
        cards: {
            key: string;
            label: string;
            value: number;
            unit: string;
            trend: number;
        }[];
        todo: {
            pendingMerchants: number;
            abnormalOrders: number;
            unreadNotifications: number;
        };
    }>;
    todo(user: JwtPayload): Promise<{
        pendingMerchants: number;
        abnormalOrders: number;
        unreadNotifications: number;
    }>;
    trend(dto: TrendQueryDto, user: JwtPayload): Promise<{
        dates: string[];
        orders: number[];
        redemptions: number[];
        exchanges: number[];
    }>;
    distribution(user: JwtPayload): Promise<{
        couponTypes: {
            type: string;
            count: number;
        }[];
        pointSources: {
            type: import(".prisma/client").$Enums.PointTxnType;
            value: number;
        }[];
    }>;
    topMerchants(user: JwtPayload): Promise<Array<{
        merchantId: number;
        name: string;
        amount: number;
    }>>;
    galaxy(user: JwtPayload): Promise<{
        center: {
            id: number;
            name: string;
            type: string;
            status: import(".prisma/client").$Enums.MerchantStatus;
            monthAmount: number;
            todayAmount: number;
            monthOrderCount: number;
            planetCount: number;
        };
        planets: {
            id: number;
            name: string;
            code: string;
            status: import(".prisma/client").$Enums.MerchantStatus;
            monthAmount: number;
            orderCount: number;
        }[];
        flows: {
            source: number;
            target: number;
            value: number;
        }[];
    }>;
}
