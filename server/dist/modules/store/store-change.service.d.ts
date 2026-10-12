import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit-log/audit.service';
import { JwtPayload } from '../auth/jwt-payload';
import { CreateStoreChangeDto, QueryStoreChangeDto, ReviewStoreChangeDto } from './dto/store-change.dto';
export declare class StoreChangeService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    private scope;
    private assertStoreInScope;
    private assertReviewer;
    private normalize;
    private pickChanges;
    submit(storeId: number, dto: CreateStoreChangeDto, user: JwtPayload, rawBody: Record<string, unknown> | undefined, ip?: string, ua?: string): Promise<{
        merchantId: number;
        storeId: number;
        id: number;
        status: import(".prisma/client").$Enums.ChangeStatus;
        createdAt: Date;
        updatedAt: Date;
        reason: string | null;
        applicantId: number | null;
        changes: Prisma.JsonValue;
        reviewerId: number | null;
        reviewRemark: string | null;
        reviewedAt: Date | null;
    }>;
    listForStore(storeId: number, user: JwtPayload): Promise<{
        merchantId: number;
        storeId: number;
        id: number;
        status: import(".prisma/client").$Enums.ChangeStatus;
        createdAt: Date;
        updatedAt: Date;
        reason: string | null;
        applicantId: number | null;
        changes: Prisma.JsonValue;
        reviewerId: number | null;
        reviewRemark: string | null;
        reviewedAt: Date | null;
    }[]>;
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
            changes: Prisma.JsonValue;
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
        changes: Prisma.JsonValue;
        reviewerId: number | null;
        reviewRemark: string | null;
        reviewedAt: Date | null;
    }>;
    review(id: number, dto: ReviewStoreChangeDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        merchantId: number;
        storeId: number;
        id: number;
        status: import(".prisma/client").$Enums.ChangeStatus;
        createdAt: Date;
        updatedAt: Date;
        reason: string | null;
        applicantId: number | null;
        changes: Prisma.JsonValue;
        reviewerId: number | null;
        reviewRemark: string | null;
        reviewedAt: Date | null;
    }>;
    cancel(id: number, user: JwtPayload, ip?: string, ua?: string): Promise<{
        id: number;
        cancelled: boolean;
    }>;
}
