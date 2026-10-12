import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit-log/audit.service';
import { JwtPayload } from '../auth/jwt-payload';
import { AdjustPointsDto, EarnPointsDto, ExchangePointsDto, QueryExchangeRecordsDto, QueryPointAccountsDto, QueryPointTransactionsDto, UpdatePointRuleDto } from './dto/point.dto';
export declare class ConcurrentSignal extends Error {
    constructor();
}
export interface FifoDeduction {
    txnId: number;
    amount: number;
    expireAt: Date | null;
}
export interface PointsExpireOptions {
    operatorId?: number | null;
    operatorType?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    triggeredBy?: 'manual' | 'cron';
}
export interface PointsExpireResult {
    processed: number;
    expiredAmount: number;
    startedAt: Date;
    finishedAt: Date;
    skipped: boolean;
    message?: string;
}
export declare class PointService {
    private readonly prisma;
    private readonly audit;
    private readonly logger;
    constructor(prisma: PrismaService, audit: AuditService);
    listAccounts(query: QueryPointAccountsDto, user: JwtPayload): Promise<{
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
    accountDetail(userId: number, user: JwtPayload): Promise<{
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
    listTransactions(query: QueryPointTransactionsDto, user: JwtPayload): Promise<{
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
    private running;
    expirePoints(opts?: PointsExpireOptions): Promise<PointsExpireResult>;
    private expireBatch;
    earn(dto: EarnPointsDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        earned: boolean;
        points: number;
        transactionId: number;
        expireAt: Date;
        balance: number;
        accountId: number;
        rule: {
            merchantId: number;
            earnRatio: number;
            minAmount: number;
        };
    } | {
        earned: boolean;
        points: number;
        reasonCode: string;
        message: string;
        rule: {
            merchantId: number;
            earnRatio: number;
            minAmount: number;
        };
    }>;
    adjust(dto: AdjustPointsDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        adjusted: boolean;
        amount: number;
        transactionId: number;
        expireAt: Date;
        balance: number;
        deductions: FifoDeduction[];
    }>;
    exchange(dto: ExchangePointsDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        idempotent: boolean;
        exchangeId: number;
        couponInstanceId: number;
        code: string;
        expireAt: Date;
        pointsCost: number;
        balance: number;
        deductions: FifoDeduction[];
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
    listExchangeRecords(query: QueryExchangeRecordsDto, user: JwtPayload): Promise<{
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
    listRules(user: JwtPayload): Promise<{
        list: {
            id: number;
            merchantId: number;
            level: string;
            earnRatio: number;
            minAmount: number;
            pointsValidMonths: number;
            expireMode: import(".prisma/client").$Enums.ExpireMode;
            status: number;
            effectiveAt: Date;
            updatedAt: Date;
        }[];
    }>;
    updateRule(id: number, dto: UpdatePointRuleDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        rule: {
            earnRatio: number;
            minAmount: number;
            pointsValidMonths: number;
            expireMode: import(".prisma/client").$Enums.ExpireMode;
            status: number;
            id: number;
            merchantId: number;
        };
    }>;
    consumeFifo(tx: Prisma.TransactionClient, userId: number, points: number, now: Date): Promise<FifoDeduction[]>;
    refundExchangePoints(tx: Prisma.TransactionClient, couponInstanceId: number, operatorId: number | null): Promise<{
        total: number;
        details: Array<{
            sourceTxnId: number;
            amount: number;
        }>;
    }>;
    adjustInTx(tx: Prisma.TransactionClient, userId: number, amount: number, operatorId: number | null, reason: string): Promise<{
        balanceAfter: number;
    }>;
    private ensureAccount;
    private resolveMerchantStore;
    private assertStore;
    private resolveOrder;
    private resolveRule;
    private computeCouponExpireAt;
    private computeExpireAt;
    private scopeFilter;
    private visibleMerchantIds;
    private assertWritableUser;
    private assertUserVisible;
}
