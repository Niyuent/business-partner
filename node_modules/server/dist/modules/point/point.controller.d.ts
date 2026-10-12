import { JwtPayload } from '../auth/jwt-payload';
import { AdjustPointsDto, EarnPointsDto, ExchangePointsDto, QueryExchangeRecordsDto, UpdatePointRuleDto } from './dto/point.dto';
import { PointService } from './point.service';
export declare class PointController {
    private readonly points;
    constructor(points: PointService);
    earn(dto: EarnPointsDto, user: JwtPayload, ip: string, ua: string): Promise<{
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
    exchange(dto: ExchangePointsDto, user: JwtPayload, ip: string, ua: string): Promise<{
        idempotent: boolean;
        exchangeId: number;
        couponInstanceId: number;
        code: string;
        expireAt: Date;
        pointsCost: number;
        balance: number;
        deductions: import("./point.service").FifoDeduction[];
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
    exchangeRecords(query: QueryExchangeRecordsDto, user: JwtPayload): Promise<{
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
    adjust(dto: AdjustPointsDto, user: JwtPayload, ip: string, ua: string): Promise<{
        adjusted: boolean;
        amount: number;
        transactionId: number;
        expireAt: Date;
        balance: number;
        deductions: import("./point.service").FifoDeduction[];
    }>;
}
export declare class PointRuleController {
    private readonly points;
    constructor(points: PointService);
    list(user: JwtPayload): Promise<{
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
    update(id: number, dto: UpdatePointRuleDto, user: JwtPayload, ip: string, ua: string): Promise<{
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
}
