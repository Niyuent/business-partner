import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit-log/audit.service';
import { JwtPayload } from '../auth/jwt-payload';
import { CreateRedemptionDto, QueryRedemptionsDto, ReverseRedemptionDto, VerifyCouponDto } from './dto/redemption.dto';
export interface CheckItem {
    item: string;
    passed: boolean;
    reasonCode?: string;
    message?: string;
}
export declare class RedemptionService {
    private readonly prisma;
    private readonly audit;
    private readonly logger;
    constructor(prisma: PrismaService, audit: AuditService);
    verify(dto: VerifyCouponDto, user: JwtPayload): Promise<{
        redeemable: boolean;
        reasonCode: any;
        reason: any;
        coupon: {
            instanceId: number;
            code: string;
            templateId: number;
            templateName: string;
            faceValue: number;
            thresholdAmount: number;
            status: import(".prisma/client").$Enums.CouponInstanceStatus;
            userId: number;
            userName: string;
            userPhone: string;
            expireAt: Date;
            applyScope: import(".prisma/client").$Enums.ApplyScope;
            stores: {
                id: number;
                name: string;
            }[];
        };
        store: {
            id: number;
            name: string;
        };
        discountAmount: number;
        checks: CheckItem[];
    }>;
    redeem(dto: CreateRedemptionDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        code: string;
        merchantId: number | null;
        storeId: number | null;
        id: number;
        status: import(".prisma/client").$Enums.RedemptionStatus;
        createdAt: Date;
        userId: number;
        operatorId: number | null;
        templateId: number;
        faceValue: Prisma.Decimal;
        discountAmount: Prisma.Decimal;
        couponInstanceId: number;
        orderId: number | null;
        channel: import(".prisma/client").$Enums.RedemptionChannel;
        reverseReason: string | null;
        reversedAt: Date | null;
        redeemedAt: Date;
    }>;
    reverse(id: number, dto: ReverseRedemptionDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        record: {
            code: string;
            merchantId: number | null;
            storeId: number | null;
            id: number;
            status: import(".prisma/client").$Enums.RedemptionStatus;
            createdAt: Date;
            userId: number;
            operatorId: number | null;
            templateId: number;
            faceValue: Prisma.Decimal;
            discountAmount: Prisma.Decimal;
            couponInstanceId: number;
            orderId: number | null;
            channel: import(".prisma/client").$Enums.RedemptionChannel;
            reverseReason: string | null;
            reversedAt: Date | null;
            redeemedAt: Date;
        };
        couponStatus: "UNUSED";
        reason: string;
    }>;
    list(query: QueryRedemptionsDto, user: JwtPayload): Promise<{
        list: {
            id: number;
            code: string;
            instanceId: number;
            templateId: number;
            templateName: string;
            userId: number;
            userName: string;
            userPhone: string;
            storeId: number;
            storeName: string;
            merchantId: number;
            merchantName: string;
            faceValue: number;
            discountAmount: number;
            orderId: number;
            orderNo: string;
            channel: import(".prisma/client").$Enums.RedemptionChannel;
            status: import(".prisma/client").$Enums.RedemptionStatus;
            reverseReason: string;
            reversedAt: Date;
            redeemedAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
        summary: {
            merchantId: number;
            merchantName: string;
            count: number;
            faceValueTotal: number;
            discountTotal: number;
        }[];
    }>;
    private resolveContext;
    private runChecks;
    private resolveStore;
    private loadStore;
    private assertReverseAllowed;
    private visibleWhere;
    private assertRecordVisible;
    private translatePrismaConflict;
}
