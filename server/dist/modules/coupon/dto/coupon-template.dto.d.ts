export declare class PageQueryDto {
    page: number;
    pageSize: number;
}
export type OwnerTypeValue = 'MAIN_COUPON' | 'SUB_COUPON';
export type CouponTypeValue = 'VOUCHER' | 'DISCOUNT';
export type ValidTypeValue = 'FIXED' | 'AFTER_RECEIVE_DAYS';
export type ApplyScopeValue = 'ALL_STORES' | 'SPECIFIED_STORES' | 'SPECIFIED_MERCHANTS';
export type TemplateStatusValue = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'VOID';
export declare class QueryCouponTemplatesDto extends PageQueryDto {
    keyword?: string;
    ownerType?: OwnerTypeValue;
    status?: TemplateStatusValue;
    ownerMerchantId?: number;
}
export declare class CreateCouponTemplateDto {
    mainMerchantId?: number;
    ownerType: OwnerTypeValue;
    ownerMerchantId?: number;
    name: string;
    subtitle?: string;
    couponType: CouponTypeValue;
    faceValue: number;
    thresholdAmount?: number;
    pointsCost?: number;
    purchasePrice?: number;
    totalStock: number;
    validType: ValidTypeValue;
    validStart?: string;
    validEnd?: string;
    validDays?: number;
    applyScope: ApplyScopeValue;
    storeIds?: number[];
    perUserLimit?: number;
    description?: string;
    rules?: string;
}
export declare class UpdateCouponTemplateDto {
    name?: string;
    subtitle?: string;
    faceValue?: number;
    thresholdAmount?: number;
    pointsCost?: number;
    purchasePrice?: number;
    totalStock?: number;
    validType?: ValidTypeValue;
    validStart?: string;
    validEnd?: string;
    validDays?: number;
    applyScope?: Exclude<ApplyScopeValue, 'SPECIFIED_MERCHANTS'>;
    storeIds?: number[];
    perUserLimit?: number;
    description?: string;
    rules?: string;
}
