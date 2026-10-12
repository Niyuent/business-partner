import { JwtPayload } from '../auth/jwt-payload';
import { QueryPointTransactionsDto } from './dto/point.dto';
import { PointService } from './point.service';
export declare class PointTransactionController {
    private readonly points;
    constructor(points: PointService);
    list(query: QueryPointTransactionsDto, user: JwtPayload): Promise<{
        list: {
            id: number;
            userId: number;
            userName: string;
            userPhone: string;
            type: import(".prisma/client").$Enums.PointTxnType;
            amount: number;
            remainingAmount: number;
            balanceAfter: number;
            expireAt: Date;
            merchantId: number;
            merchantName: string;
            storeId: number;
            relatedOrderId: number;
            relatedCouponInstanceId: number;
            sourceTransactionId: number;
            originBatchId: number;
            operatorId: number;
            operatorName: string;
            remark: string;
            createdAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
}
