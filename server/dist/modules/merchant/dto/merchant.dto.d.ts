export declare class PageQueryDto {
    page: number;
    pageSize: number;
}
export declare class QueryMerchantsDto extends PageQueryDto {
    status?: string;
    type?: string;
    keyword?: string;
}
export declare class UpdateMerchantStatusDto {
    status: 'APPROVED' | 'SUSPENDED';
    remark?: string;
}
