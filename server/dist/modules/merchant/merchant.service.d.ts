import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit-log/audit.service';
import { JwtPayload } from '../auth/jwt-payload';
import { ApproveApplicationDto, CreateApplicationDto, QueryApplicationsDto, RejectApplicationDto } from './dto/application.dto';
import { QueryMerchantsDto, UpdateMerchantStatusDto } from './dto/merchant.dto';
export declare class MerchantService {
    private readonly prisma;
    private readonly audit;
    private readonly logger;
    constructor(prisma: PrismaService, audit: AuditService);
    createApplication(dto: CreateApplicationDto, ip?: string, ua?: string): Promise<{
        code: string;
        type: import(".prisma/client").$Enums.MerchantType;
        id: number;
        status: import(".prisma/client").$Enums.MerchantStatus;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        parentId: number | null;
        contactName: string | null;
        contactPhone: string | null;
        licenseNo: string | null;
        licenseImages: Prisma.JsonValue | null;
        province: string | null;
        city: string | null;
        district: string | null;
        address: string | null;
        settleContact: string | null;
        auditRemark: string | null;
        auditorId: number | null;
        auditedAt: Date | null;
    }>;
    listApplications(query: QueryApplicationsDto, user: JwtPayload): Promise<{
        list: {
            code: string;
            id: number;
            status: import(".prisma/client").$Enums.MerchantStatus;
            createdAt: Date;
            name: string;
            contactName: string;
            contactPhone: string;
            licenseNo: string;
            licenseImages: Prisma.JsonValue;
            province: string;
            city: string;
            district: string;
            address: string;
            auditRemark: string;
            auditedAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    approve(id: number, dto: ApproveApplicationDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        merchant: {
            code: string;
            type: import(".prisma/client").$Enums.MerchantType;
            id: number;
            status: import(".prisma/client").$Enums.MerchantStatus;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            parentId: number | null;
            contactName: string | null;
            contactPhone: string | null;
            licenseNo: string | null;
            licenseImages: Prisma.JsonValue | null;
            province: string | null;
            city: string | null;
            district: string | null;
            address: string | null;
            settleContact: string | null;
            auditRemark: string | null;
            auditorId: number | null;
            auditedAt: Date | null;
        };
        account: {
            username: string;
            password: string;
            adminUserId: number;
        };
        hint: string;
    }>;
    reject(id: number, dto: RejectApplicationDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        code: string;
        type: import(".prisma/client").$Enums.MerchantType;
        id: number;
        status: import(".prisma/client").$Enums.MerchantStatus;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        parentId: number | null;
        contactName: string | null;
        contactPhone: string | null;
        licenseNo: string | null;
        licenseImages: Prisma.JsonValue | null;
        province: string | null;
        city: string | null;
        district: string | null;
        address: string | null;
        settleContact: string | null;
        auditRemark: string | null;
        auditorId: number | null;
        auditedAt: Date | null;
    }>;
    private assertReviewable;
    list(query: QueryMerchantsDto, user: JwtPayload): Promise<{
        list: {
            code: string;
            type: import(".prisma/client").$Enums.MerchantType;
            id: number;
            status: import(".prisma/client").$Enums.MerchantStatus;
            createdAt: Date;
            _count: {
                stores: number;
                adminUsers: number;
            };
            name: string;
            contactName: string;
            contactPhone: string;
            auditRemark: string;
            parent: {
                id: number;
                name: string;
            };
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    detail(id: number, user: JwtPayload): Promise<{
        parent: {
            code: string;
            id: number;
            name: string;
        };
        stores: {
            code: string;
            id: number;
            status: import(".prisma/client").$Enums.StoreStatus;
            name: string;
        }[];
        adminUsers: {
            username: string;
            userType: import(".prisma/client").$Enums.AdminUserType;
            id: number;
            status: import(".prisma/client").$Enums.UserStatus;
            realName: string;
        }[];
    } & {
        code: string;
        type: import(".prisma/client").$Enums.MerchantType;
        id: number;
        status: import(".prisma/client").$Enums.MerchantStatus;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        parentId: number | null;
        contactName: string | null;
        contactPhone: string | null;
        licenseNo: string | null;
        licenseImages: Prisma.JsonValue | null;
        province: string | null;
        city: string | null;
        district: string | null;
        address: string | null;
        settleContact: string | null;
        auditRemark: string | null;
        auditorId: number | null;
        auditedAt: Date | null;
    }>;
    updateStatus(id: number, dto: UpdateMerchantStatusDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        code: string;
        type: import(".prisma/client").$Enums.MerchantType;
        id: number;
        status: import(".prisma/client").$Enums.MerchantStatus;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        parentId: number | null;
        contactName: string | null;
        contactPhone: string | null;
        licenseNo: string | null;
        licenseImages: Prisma.JsonValue | null;
        province: string | null;
        city: string | null;
        district: string | null;
        address: string | null;
        settleContact: string | null;
        auditRemark: string | null;
        auditorId: number | null;
        auditedAt: Date | null;
    }>;
    private visibilityWhere;
    private nextMerchantCode;
    private createMerchantAdmin;
}
