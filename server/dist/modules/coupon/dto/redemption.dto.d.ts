import { PageQueryDto } from './coupon-template.dto';
export type ChannelValue = 'MANUAL' | 'SCAN' | 'API';
export type RedemptionStatusValue = 'SUCCESS' | 'REVERSED';
export declare class VerifyCouponDto {
    code: string;
    storeId?: number;
    userId?: number;
    orderNo?: string;
    orderAmount?: number;
}
export declare class CreateRedemptionDto extends VerifyCouponDto {
    orderNo: string;
    channel?: ChannelValue;
    orderSource?: 'APPLET' | 'WEB' | 'IMPORT';
    remark?: string;
}
export declare class QueryRedemptionsDto extends PageQueryDto {
    code?: string;
    templateId?: number;
    userId?: number;
    storeId?: number;
    merchantId?: number;
    status?: RedemptionStatusValue;
    redeemedFrom?: string;
    redeemedTo?: string;
}
export declare class ReverseRedemptionDto {
    reason: string;
}
