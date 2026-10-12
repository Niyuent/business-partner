import type { Request } from 'express';
import { JwtPayload } from '../auth/jwt-payload';
import { CreateStoreChangeDto, QueryStoreChangeDto, ReviewStoreChangeDto } from './dto/store-change.dto';
import { StoreChangeService } from './store-change.service';
export declare class StoreChangeController {
    private readonly service;
    constructor(service: StoreChangeService);
    listForReview(query: QueryStoreChangeDto, user: JwtPayload): Promise<{
        list: ({
            store: {
                code: string;
                merchantId: number;
                id: number;
                name: string;
            };
        } & {
            merchantId: number;
            storeId: number;
            id: number;
            status: import(".prisma/client").$Enums.ChangeStatus;
            createdAt: Date;
            updatedAt: Date;
            reason: string | null;
            applicantId: number | null;
            changes: import("@prisma/client/runtime/library").JsonValue;
            reviewerId: number | null;
            reviewRemark: string | null;
            reviewedAt: Date | null;
        })[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    detail(id: number, user: JwtPayload): Promise<{
        store: {
            code: string;
            merchantId: number;
            id: number;
            name: string;
        };
    } & {
        merchantId: number;
        storeId: number;
        id: number;
        status: import(".prisma/client").$Enums.ChangeStatus;
        createdAt: Date;
        updatedAt: Date;
        reason: string | null;
        applicantId: number | null;
        changes: import("@prisma/client/runtime/library").JsonValue;
        reviewerId: number | null;
        reviewRemark: string | null;
        reviewedAt: Date | null;
    }>;
    review(id: number, dto: ReviewStoreChangeDto, user: JwtPayload, ip: string, ua?: string): Promise<{
        merchantId: number;
        storeId: number;
        id: number;
        status: import(".prisma/client").$Enums.ChangeStatus;
        createdAt: Date;
        updatedAt: Date;
        reason: string | null;
        applicantId: number | null;
        changes: import("@prisma/client/runtime/library").JsonValue;
        reviewerId: number | null;
        reviewRemark: string | null;
        reviewedAt: Date | null;
    }>;
    cancel(id: number, user: JwtPayload, ip: string, ua?: string): Promise<{
        id: number;
        cancelled: boolean;
    }>;
    submit(id: number, dto: CreateStoreChangeDto, req: Request, user: JwtPayload, ip: string, ua?: string): Promise<{
        merchantId: number;
        storeId: number;
        id: number;
        status: import(".prisma/client").$Enums.ChangeStatus;
        createdAt: Date;
        updatedAt: Date;
        reason: string | null;
        applicantId: number | null;
        changes: import("@prisma/client/runtime/library").JsonValue;
        reviewerId: number | null;
        reviewRemark: string | null;
        reviewedAt: Date | null;
    }>;
    listForStore(id: number, user: JwtPayload): Promise<{
        merchantId: number;
        storeId: number;
        id: number;
        status: import(".prisma/client").$Enums.ChangeStatus;
        createdAt: Date;
        updatedAt: Date;
        reason: string | null;
        applicantId: number | null;
        changes: import("@prisma/client/runtime/library").JsonValue;
        reviewerId: number | null;
        reviewRemark: string | null;
        reviewedAt: Date | null;
    }[]>;
}
