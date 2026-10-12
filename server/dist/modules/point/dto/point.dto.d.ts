import { PageQueryDto } from '../../coupon/dto/coupon-template.dto';
import { PointTxnType } from '@prisma/client';
export declare class QueryPointAccountsDto extends PageQueryDto {
    keyword?: string;
    minBalance?: number;
    expiringSoon?: boolean;
}
export declare class QueryPointTransactionsDto extends PageQueryDto {
    userId?: number;
    type?: PointTxnType;
    merchantId?: number;
    storeId?: number;
    from?: string;
    to?: string;
}
export declare class EarnPointsDto {
    userId: number;
    amount: number;
    orderId?: number;
    orderNo?: string;
    merchantId?: number;
    storeId?: number;
    remark?: string;
}
export declare class AdjustPointsDto {
    userId: number;
    amount: number;
    reason: string;
    expireAt?: string;
}
export declare class ExchangePointsDto {
    userId: number;
    templateId: number;
    requestId: string;
    channel?: 'H5' | 'WEB';
    remark?: string;
}
export declare class QueryExchangeRecordsDto extends PageQueryDto {
    userId?: number;
    templateId?: number;
    from?: string;
    to?: string;
}
export declare class UpdatePointRuleDto {
    earnRatio?: number;
    minAmount?: number;
    pointsValidMonths?: number;
    expireMode?: 'FIXED_MONTHS' | 'YEAR_END';
    status?: number;
}
