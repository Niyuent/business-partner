export declare class PageQueryDto {
    page: number;
    pageSize: number;
}
export declare class QueryAuditLogsDto extends PageQueryDto {
    module?: string;
    operatorId?: number;
    operatorKeyword?: string;
    action?: string;
    targetType?: string;
    targetId?: number;
    result?: string;
    from?: string;
    to?: string;
}
