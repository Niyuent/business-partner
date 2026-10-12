import { JwtPayload } from '../auth/jwt-payload';
import { TrendQueryDto } from './dto/report.dto';
import { ReportService } from './report.service';
export declare class DashboardController {
    private readonly reports;
    constructor(reports: ReportService);
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
    trend(q: TrendQueryDto, user: JwtPayload): Promise<{
        dates: string[];
        orders: number[];
        redemptions: number[];
        exchanges: number[];
    }>;
    todo(user: JwtPayload): Promise<{
        pendingMerchants: number;
        abnormalOrders: number;
        unreadNotifications: number;
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
    topMerchants(user: JwtPayload): Promise<{
        merchantId: number;
        name: string;
        amount: number;
    }[]>;
}
