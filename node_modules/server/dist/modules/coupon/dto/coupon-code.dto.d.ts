import { PageQueryDto } from './coupon-template.dto';
export type CodeStatusValue = 'UNISSUED' | 'ISSUED' | 'REDEEMED' | 'VOID';
export declare class GenerateCodesDto {
    batchNo?: string;
    quantity: number;
    remark?: string;
}
export declare class QueryCodesDto extends PageQueryDto {
    status?: CodeStatusValue;
    batchNo?: string;
    batchId?: number;
    code?: string;
    withCode?: boolean;
}
export declare class QueryBatchesDto extends PageQueryDto {
    templateId?: number;
}
