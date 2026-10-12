import { PageQueryDto } from './coupon-template.dto';
export type InstanceStatusValue = 'UNUSED' | 'USED' | 'EXPIRED' | 'FROZEN';
export type SourceValue = 'EXCHANGE' | 'MERCHANT_ISSUE' | 'GIFT';
export declare class IssueCouponDto {
    templateId: number;
    userId?: number;
    phone?: string;
    quantity?: number;
    merchantId?: number;
    remark?: string;
}
export declare class QueryInstancesDto extends PageQueryDto {
    templateId?: number;
    userId?: number;
    status?: InstanceStatusValue;
    issuerMerchantId?: number;
    code?: string;
    expireFrom?: string;
    expireTo?: string;
}
export declare class FreezeInstanceDto {
    frozen: boolean;
    reason?: string;
}
