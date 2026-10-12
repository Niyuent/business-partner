import { ChangeStatus } from '@prisma/client';
export declare const CHANGEABLE_FIELDS: readonly ["name", "contactName", "contactPhone", "province", "city", "district", "address", "lng", "lat", "businessHours", "logo"];
export declare const FORBIDDEN_FIELDS: readonly ["id", "code", "merchantId", "storeId", "status"];
export declare class CreateStoreChangeDto {
    name?: string;
    contactName?: string;
    contactPhone?: string;
    province?: string;
    city?: string;
    district?: string;
    address?: string;
    lng?: number;
    lat?: number;
    businessHours?: string;
    logo?: string;
    reason?: string;
}
export declare class ReviewStoreChangeDto {
    decision: 'APPROVE' | 'REJECT';
    remark?: string;
}
export declare class QueryStoreChangeDto {
    page?: number;
    pageSize?: number;
    status?: ChangeStatus;
    storeId?: number;
    merchantId?: number;
}
