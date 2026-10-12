import { JwtPayload } from '../auth/jwt-payload';
import { AuditService } from './audit.service';
import { QueryAuditLogsDto } from './dto/audit-log.dto';
export declare class AuditLogController {
    private readonly audits;
    constructor(audits: AuditService);
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
}
