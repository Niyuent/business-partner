export declare class PageQueryDto {
    page: number;
    pageSize: number;
}
export type AuthorizationType = 'ISSUE_MAIN_COUPON';
export type TemplateScopeValue = 'ALL' | 'SPECIFIED';
export declare class CreateAuthorizationDto {
    mainMerchantId?: number;
    subMerchantId: number;
    authType: AuthorizationType;
    templateScope: TemplateScopeValue;
    templateIds?: number[];
}
export declare class DisableAuthorizationDto {
    revokeReason?: string;
}
export declare class QueryAuthorizationsDto extends PageQueryDto {
    subMerchantId?: number;
    status?: string;
}
export declare class QueryAuthorizationLogsDto extends PageQueryDto {
    mainMerchantId?: number;
    subMerchantId?: number;
    action?: string;
    from?: string;
    to?: string;
}
export declare class QueryMeAuthorizationsDto {
    merchantId?: number;
    subMerchantId?: number;
    mainMerchantId?: number;
}
