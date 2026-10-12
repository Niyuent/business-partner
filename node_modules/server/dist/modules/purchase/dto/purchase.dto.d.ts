export declare class QueryPurchasesDto {
    page: number;
    pageSize: number;
    subMerchantId?: number;
    settleStatus?: string;
    from?: string;
    to?: string;
}
export declare class CreatePurchaseDto {
    subMerchantId?: number;
    mainMerchantId?: number;
    templateId: number;
    quantity: number;
    unitPrice: number;
    totalAmount?: number;
    purchasedAt?: string;
    remark?: string;
}
export declare class SettlePurchaseDto {
    settleRemark?: string;
}
