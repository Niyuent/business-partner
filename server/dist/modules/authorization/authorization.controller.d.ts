import { JwtPayload } from '../auth/jwt-payload';
import { AuthorizationService } from './authorization.service';
import { CreateAuthorizationDto, DisableAuthorizationDto, QueryAuthorizationLogsDto, QueryAuthorizationsDto } from './dto/authorization.dto';
export declare class AuthorizationController {
    private readonly authorizations;
    constructor(authorizations: AuthorizationService);
    availableTemplates(user: JwtPayload): Promise<{
        mainMerchantId: number;
        templates: {
            id: number;
            name: string;
            couponType: import(".prisma/client").$Enums.CouponType;
            faceValue: import("@prisma/client/runtime/library").Decimal;
            thresholdAmount: import("@prisma/client/runtime/library").Decimal;
            pointsCost: number;
            totalStock: number;
            issuedCount: number;
            validEnd: Date;
        }[];
    }>;
    logs(query: QueryAuthorizationLogsDto, user: JwtPayload): Promise<{
        list: {
            id: number;
            action: string;
            result: import(".prisma/client").$Enums.AuditResult;
            targetType: string;
            targetId: number;
            operatorId: number;
            operatorType: string;
            operatorName: string;
            ip: string;
            before: import("@prisma/client/runtime/library").JsonValue;
            after: import("@prisma/client/runtime/library").JsonValue;
            createdAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    list(query: QueryAuthorizationsDto, user: JwtPayload): Promise<{
        list: import("./authorization.service").AuthorizationView[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    create(dto: CreateAuthorizationDto, user: JwtPayload, ip: string, ua: string): Promise<{
        authorization: import("./authorization.service").AuthorizationView;
        reactivated: boolean;
    }>;
    disable(id: number, dto: DisableAuthorizationDto, user: JwtPayload, ip: string, ua: string): Promise<{
        authorization: import("./authorization.service").AuthorizationView;
        alreadyDisabled: boolean;
    }>;
}
