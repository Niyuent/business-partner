import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit-log/audit.service';
import { JwtPayload } from '../auth/jwt-payload';
import { CreateAuthorizationDto, DisableAuthorizationDto, QueryAuthorizationLogsDto, QueryAuthorizationsDto, QueryMeAuthorizationsDto } from './dto/authorization.dto';
export interface AuthorizationView {
    id: number;
    mainMerchantId: number;
    mainMerchantName: string | null;
    subMerchantId: number;
    subMerchantName: string | null;
    authType: string;
    status: string;
    templateScope: string;
    templateIds: number[];
    grantedBy: number | null;
    grantedAt: Date | null;
    revokedBy: number | null;
    revokedAt: Date | null;
    revokeReason: string | null;
}
export declare class AuthorizationService {
    private readonly prisma;
    private readonly audit;
    private readonly logger;
    constructor(prisma: PrismaService, audit: AuditService);
    list(query: QueryAuthorizationsDto, user: JwtPayload): Promise<{
        list: AuthorizationView[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    availableTemplates(user: JwtPayload): Promise<{
        mainMerchantId: number;
        templates: {
            id: number;
            name: string;
            couponType: import(".prisma/client").$Enums.CouponType;
            faceValue: Prisma.Decimal;
            thresholdAmount: Prisma.Decimal;
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
            before: Prisma.JsonValue;
            after: Prisma.JsonValue;
            createdAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    create(dto: CreateAuthorizationDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        authorization: AuthorizationView;
        reactivated: boolean;
    }>;
    disable(id: number, dto: DisableAuthorizationDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        authorization: AuthorizationView;
        alreadyDisabled: boolean;
    }>;
    me(user: JwtPayload, query: QueryMeAuthorizationsDto): Promise<{
        merchantId: number;
        merchantName: string;
        merchantType: import(".prisma/client").$Enums.MerchantType;
        canIssueMainCoupon: boolean;
        issueMainCoupon: {
            authorizationId: number;
            mainMerchantId: number;
            templateScope: string;
            allowsAllTemplates: boolean;
            templateIds: number[];
            grantedAt: Date;
        };
        authorizations: AuthorizationView[];
    }>;
    getEffectiveGrant(subMerchantId: number, mainMerchantId?: number): Promise<{
        templates: {
            templateId: number;
        }[];
        mainMerchant: {
            id: number;
            name: string;
        };
    } & {
        id: number;
        status: import(".prisma/client").$Enums.AuthStatus;
        createdAt: Date;
        updatedAt: Date;
        mainMerchantId: number;
        subMerchantId: number;
        authType: import(".prisma/client").$Enums.AuthType;
        templateScope: import(".prisma/client").$Enums.TemplateScope;
        grantedBy: number | null;
        grantedAt: Date;
        revokedBy: number | null;
        revokedAt: Date | null;
        revokeReason: string | null;
    }>;
    checkAuthorization(subMerchantId: number, templateId: number): Promise<{
        authorizationId: number;
        mainMerchantId: number;
        templateScope: import(".prisma/client").$Enums.TemplateScope;
        template: {
            description: string | null;
            id: number;
            status: import(".prisma/client").$Enums.CouponTemplateStatus;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            creatorMerchantId: number;
            ownerMerchantId: number;
            ownerType: import(".prisma/client").$Enums.CouponOwnerType;
            subtitle: string | null;
            couponType: import(".prisma/client").$Enums.CouponType;
            faceValue: Prisma.Decimal;
            thresholdAmount: Prisma.Decimal;
            pointsCost: number;
            purchasePrice: Prisma.Decimal;
            totalStock: number;
            issuedCount: number;
            usedCount: number;
            validType: import(".prisma/client").$Enums.ValidType;
            validStart: Date | null;
            validEnd: Date | null;
            validDays: number;
            applyScope: import(".prisma/client").$Enums.ApplyScope;
            perUserLimit: number;
            rules: string | null;
        };
    }>;
    private resolveMainMerchantId;
    private assertOwnSub;
    private resolveTemplates;
    private authorizationView;
    private toView;
    private isAuthUniqueViolation;
    private reasonCodeOf;
}
