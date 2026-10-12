export declare const ABNORMAL_TYPES: readonly ["AMOUNT_ERROR", "DUPLICATE_COUPON", "REFUND_NOT_RETURNED", "STORE_DISPUTE"];
export declare const HANDLE_TYPES: readonly ["CANCEL", "AMOUNT_ERROR", "DISPUTE"];
export declare class QueryOrdersDto {
    page: number;
    pageSize: number;
    status?: string;
    orderNo?: string;
    userId?: number;
    merchantId?: number;
    storeId?: number;
    from?: string;
    to?: string;
}
export declare class CreateOrderDto {
    orderNo: string;
    userId: number;
    merchantId?: number;
    storeId?: number;
    orderType?: 'CONSUME' | 'EXCHANGE';
    totalAmount: number;
    discountAmount?: number;
    payAmount?: number;
    source?: 'APPLET' | 'WEB' | 'IMPORT';
    amount?: number;
    remark?: string;
}
export declare class MarkAbnormalDto {
    abnormalType: (typeof ABNORMAL_TYPES)[number];
    abnormalRemark: string;
}
export declare class HandleOrderDto {
    handleType: (typeof HANDLE_TYPES)[number];
    result?: string;
}
