import { UserJwtPayload } from '../auth/user-jwt-payload';
import { ExchangePointsDto, QueryExchangeRecordsDto, QueryPointTransactionsDto } from '../point/dto/point.dto';
import { H5Service } from './h5.service';
export declare class H5Controller {
    private readonly h5;
    constructor(h5: H5Service);
    me(user: UserJwtPayload): Promise<{
        openid: string;
        unionid: string;
        id: number;
        phone: string;
        nickname: string;
        avatar: string;
        status: import(".prisma/client").$Enums.UserStatus;
        registeredAt: Date;
    }>;
    account(user: UserJwtPayload): Promise<{
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
    transactions(user: UserJwtPayload, query: QueryPointTransactionsDto): Promise<{
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
    templates(): Promise<{
        list: {
            id: number;
            name: string;
            subtitle: string;
            status: import(".prisma/client").$Enums.CouponTemplateStatus;
            faceValue: number;
            thresholdAmount: number;
            pointsCost: number;
            perUserLimit: number;
            totalStock: number;
            remainingStock: number;
        }[];
    }>;
    exchangeRecords(user: UserJwtPayload, query: QueryExchangeRecordsDto): Promise<{
        list: {
            id: number;
            userId: number;
            userName: string;
            userPhone: string;
            templateId: number;
            templateName: string;
            faceValue: number;
            couponInstanceId: number;
            code: string;
            couponStatus: import(".prisma/client").$Enums.CouponInstanceStatus;
            couponExpireAt: Date;
            pointsCost: number;
            requestId: string;
            channel: string;
            operatorId: number;
            remark: string;
            createdAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    exchange(user: UserJwtPayload, dto: ExchangePointsDto): Promise<{
        idempotent: boolean;
        exchangeId: number;
        couponInstanceId: number;
        code: string;
        expireAt: Date;
        pointsCost: number;
        balance: number;
        deductions: import("../point/point.service").FifoDeduction[];
    } | {
        idempotent: boolean;
        exchangeId: number;
        couponInstanceId: number;
        code: string;
        expireAt: Date;
        pointsCost: number;
        templateId: number;
        createdAt: Date;
    }>;
}
