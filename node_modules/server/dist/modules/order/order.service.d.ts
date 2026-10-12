import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit-log/audit.service';
import { JwtPayload } from '../auth/jwt-payload';
import { PointService } from '../point/point.service';
import { CreateOrderDto, HandleOrderDto, MarkAbnormalDto, QueryOrdersDto } from './dto/order.dto';
export declare class OrderService {
    private readonly prisma;
    private readonly audit;
    private readonly points;
    private readonly logger;
    constructor(prisma: PrismaService, audit: AuditService, points: PointService);
    list(query: QueryOrdersDto, user: JwtPayload): Promise<{
        list: {
            id: number;
            orderNo: string;
            userId: number;
            userName: string;
            userPhone: string;
            merchantId: number;
            merchantName: string;
            storeId: number;
            storeName: string;
            orderType: import(".prisma/client").$Enums.OrderType;
            totalAmount: number;
            payAmount: number;
            pointsEarned: number;
            status: import(".prisma/client").$Enums.OrderStatus;
            abnormalType: string;
            couponInstanceId: number;
            couponCode: string;
            couponStatus: import(".prisma/client").$Enums.CouponInstanceStatus;
            handleResult: string;
            handledAt: Date;
            consumeTime: Date;
            createdAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    detail(id: number, user: JwtPayload): Promise<{
        order: {
            id: number;
            orderNo: string;
            userId: number;
            userName: string;
            userPhone: string;
            merchantId: number;
            merchantName: string;
            storeId: number;
            storeName: string;
            orderType: import(".prisma/client").$Enums.OrderType;
            totalAmount: number;
            discountAmount: number;
            payAmount: number;
            pointsEarned: number;
            status: import(".prisma/client").$Enums.OrderStatus;
            abnormalType: string;
            abnormalRemark: string;
            handledBy: number;
            handledAt: Date;
            handleResult: string;
            source: import(".prisma/client").$Enums.OrderSource;
            consumeTime: Date;
            createdAt: Date;
            couponInstance: {
                id: number;
                code: string;
                status: import(".prisma/client").$Enums.CouponInstanceStatus;
                templateName: string;
                faceValue: number;
            };
        };
        redemptions: {
            id: number;
            code: string;
            status: import(".prisma/client").$Enums.RedemptionStatus;
            faceValue: number;
            discountAmount: number;
            redeemedAt: Date;
            reverseReason: string;
            reversedAt: Date;
        }[];
        pointTxns: {
            id: number;
            type: import(".prisma/client").$Enums.PointTxnType;
            amount: number;
            remainingAmount: number;
            balanceAfter: number;
            sourceTransactionId: number;
            originBatchId: number;
            relatedOrderId: number;
            relatedCouponInstanceId: number;
            remark: string;
            createdAt: Date;
        }[];
    }>;
    listAbnormal(query: QueryOrdersDto, user: JwtPayload): Promise<{
        list: {
            id: number;
            orderNo: string;
            userId: number;
            userName: string;
            userPhone: string;
            merchantId: number;
            merchantName: string;
            storeId: number;
            storeName: string;
            orderType: import(".prisma/client").$Enums.OrderType;
            totalAmount: number;
            payAmount: number;
            pointsEarned: number;
            status: import(".prisma/client").$Enums.OrderStatus;
            abnormalType: string;
            couponInstanceId: number;
            couponCode: string;
            couponStatus: import(".prisma/client").$Enums.CouponInstanceStatus;
            handleResult: string;
            handledAt: Date;
            consumeTime: Date;
            createdAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    create(dto: CreateOrderDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        order: {
            id: number;
            orderNo: string;
            status: import(".prisma/client").$Enums.OrderStatus;
        };
        points: unknown;
    }>;
    markAbnormal(id: number, dto: MarkAbnormalDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        id: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        abnormalType: "AMOUNT_ERROR" | "DUPLICATE_COUPON" | "REFUND_NOT_RETURNED" | "STORE_DISPUTE";
        abnormalRemark: string;
    }>;
    handle(id: number, dto: HandleOrderDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        id: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        handleType: "AMOUNT_ERROR" | "CANCEL" | "DISPUTE";
        handleResult: string;
        refund: {
            total: number;
            details: Array<{
                sourceTxnId: number;
                amount: number;
            }>;
        };
    }>;
    private defaultResult;
    private resolveCreateScope;
    private orderScope;
    private assertOrderVisible;
    private assertHandleAllowed;
}
