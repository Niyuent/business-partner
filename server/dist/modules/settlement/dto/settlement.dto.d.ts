export declare class GenerateSettlementDto {
    merchantId?: number | null;
    periodStart: string;
    periodEnd: string;
}
export declare class QuerySettlementsDto {
    page: number;
    pageSize: number;
    merchantId?: number;
    status?: string;
    periodStart?: string;
    periodEnd?: string;
}
export declare class ConfirmSettlementDto {
    confirm: boolean;
    disputeReason?: string;
}
