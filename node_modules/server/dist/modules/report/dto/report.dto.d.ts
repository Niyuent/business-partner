export declare const REPORT_KEYS: readonly ["merchant-onboarding", "orders-summary", "coupon-summary", "points-summary", "store-settlement", "authorization-logs"];
export type ReportKey = (typeof REPORT_KEYS)[number];
export declare class ReportQueryDto {
    page: number;
    pageSize: number;
    from?: string;
    to?: string;
    merchantId?: number;
}
export declare class TrendQueryDto {
    days: number;
}
export declare class ReportKeyParamDto {
    key: string;
}
