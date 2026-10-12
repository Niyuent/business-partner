import { JwtPayload } from '../auth/jwt-payload';
import { QueryPointAccountsDto } from './dto/point.dto';
import { PointService } from './point.service';
export declare class PointAccountController {
    private readonly points;
    constructor(points: PointService);
    list(query: QueryPointAccountsDto, user: JwtPayload): Promise<{
        list: {
            id: number;
            userId: number;
            userName: string;
            userPhone: string;
            balance: number;
            totalEarned: number;
            totalSpent: number;
            totalExpired: number;
            expiringSoon: number;
            version: number;
            updatedAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    detail(userId: number, user: JwtPayload): Promise<{
        account: {
            id: number;
            userId: number;
            userName: string;
            userPhone: string;
            balance: number;
            totalEarned: number;
            totalSpent: number;
            totalExpired: number;
            version: number;
            updatedAt: Date;
        };
        summary: {
            available: number;
            expiringSoon: number;
            expiredPending: number;
            batchCount: number;
        };
        batches: {
            id: number;
            type: import(".prisma/client").$Enums.PointTxnType;
            amount: number;
            remainingAmount: number;
            expireAt: Date;
            usable: boolean;
            merchantId: number;
            merchantName: string;
            storeId: number;
            createdAt: Date;
            remark: string;
        }[];
    }>;
}
