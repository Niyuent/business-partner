import { JwtPayload } from '../auth/jwt-payload';
import { CouponInstanceService } from './coupon-instance.service';
import { FreezeInstanceDto, IssueCouponDto, QueryInstancesDto } from './dto/coupon-instance.dto';
export declare class CouponInstanceController {
    private readonly instances;
    constructor(instances: CouponInstanceService);
    issue(dto: IssueCouponDto, user: JwtPayload, ip: string, ua: string): Promise<{
        issued: {
            issuerMerchantName: string;
            id: number;
            userId: number;
            userName: string | null;
            userPhone: string | null;
            templateId: number;
            templateName: string | null;
            code: string | null;
            issuerMerchantId: number | null;
            source: import(".prisma/client").CouponSource;
            pointsCost: number;
            status: import(".prisma/client").CouponInstanceStatus;
            obtainedAt: Date;
            expireAt: Date;
            usedAt: Date | null;
            createdAt: Date;
        }[];
        quantity: number;
        expireAt: Date;
    }>;
    list(query: QueryInstancesDto, user: JwtPayload): Promise<{
        list: {
            issuerMerchantName: string;
            id: number;
            userId: number;
            userName: string | null;
            userPhone: string | null;
            templateId: number;
            templateName: string | null;
            code: string | null;
            issuerMerchantId: number | null;
            source: import(".prisma/client").CouponSource;
            pointsCost: number;
            status: import(".prisma/client").CouponInstanceStatus;
            obtainedAt: Date;
            expireAt: Date;
            usedAt: Date | null;
            createdAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    detail(id: number, user: JwtPayload): Promise<{
        instance: {
            faceValue: number;
            thresholdAmount: number;
            applyScope: import(".prisma/client").$Enums.ApplyScope;
            stores: {
                id: number;
                name: string;
            }[];
            redemptions: {
                id: number;
                code: string;
                status: import(".prisma/client").$Enums.RedemptionStatus;
                channel: import(".prisma/client").$Enums.RedemptionChannel;
                storeId: number;
                storeName: string;
                operatorId: number;
                operatorName: string;
                orderId: number;
                orderNo: string;
                faceValue: number;
                discountAmount: number;
                reverseReason: string;
                reversedAt: Date;
                redeemedAt: Date;
            }[];
            issuerMerchantName: string;
            id: number;
            userId: number;
            userName: string | null;
            userPhone: string | null;
            templateId: number;
            templateName: string | null;
            code: string | null;
            issuerMerchantId: number | null;
            source: import(".prisma/client").CouponSource;
            pointsCost: number;
            status: import(".prisma/client").CouponInstanceStatus;
            obtainedAt: Date;
            expireAt: Date;
            usedAt: Date | null;
            createdAt: Date;
        };
    }>;
    freeze(id: number, dto: FreezeInstanceDto, user: JwtPayload, ip: string, ua: string): Promise<{
        instance: {
            issuerMerchantName: string;
            id: number;
            userId: number;
            userName: string | null;
            userPhone: string | null;
            templateId: number;
            templateName: string | null;
            code: string | null;
            issuerMerchantId: number | null;
            source: import(".prisma/client").CouponSource;
            pointsCost: number;
            status: import(".prisma/client").CouponInstanceStatus;
            obtainedAt: Date;
            expireAt: Date;
            usedAt: Date | null;
            createdAt: Date;
        };
    }>;
}
