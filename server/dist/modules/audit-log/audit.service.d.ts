import { AuditResult, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload';
import { QueryAuditLogsDto } from './dto/audit-log.dto';
export interface AuditRecordInput {
    operatorId?: number | null;
    operatorType?: string;
    operatorName?: string;
    module: string;
    action: string;
    targetType?: string;
    targetId?: number | null;
    before?: unknown;
    after?: unknown;
    ip?: string | null;
    userAgent?: string | null;
    result?: AuditResult;
}
export declare class AuditService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    list(query: QueryAuditLogsDto, user: JwtPayload): Promise<{
        list: {
            id: number;
            module: string;
            action: string;
            result: import(".prisma/client").$Enums.AuditResult;
            targetType: string;
            targetId: number;
            operatorId: number;
            operatorType: string;
            operatorName: string;
            ip: string;
            hasDetail: boolean;
            createdAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    detail(id: number, user: JwtPayload): Promise<{
        id: number;
        module: string;
        action: string;
        result: import(".prisma/client").$Enums.AuditResult;
        targetType: string;
        targetId: number;
        operatorId: number;
        operatorType: string;
        operatorName: string;
        operatorUsername: string;
        ip: string;
        userAgent: string;
        before: unknown;
        after: unknown;
        createdAt: Date;
    }>;
    private visibilityWhere;
    private mask;
    record(input: AuditRecordInput, tx?: Prisma.TransactionClient): Promise<{
        result: import(".prisma/client").$Enums.AuditResult;
        id: number;
        createdAt: Date;
        module: string;
        operatorId: number | null;
        action: string;
        targetType: string | null;
        targetId: number | null;
        operatorName: string | null;
        operatorType: string | null;
        beforeData: Prisma.JsonValue | null;
        afterData: Prisma.JsonValue | null;
        ip: string | null;
        userAgent: string | null;
    }>;
}
