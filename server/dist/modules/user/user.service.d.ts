import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit-log/audit.service';
import { JwtPayload } from '../auth/jwt-payload';
import { BindPhoneDto, QueryUsersDto, UpdateUserStatusDto } from './dto/user.dto';
export declare class UserService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    private scope;
    private scopeUserFilter;
    list(query: QueryUsersDto, user: JwtPayload): Promise<{
        list: {
            id: number;
            phone: string;
            nickname: string;
            avatar: string;
            status: import(".prisma/client").$Enums.UserStatus;
            registeredAt: Date;
            bound: boolean;
            balance: number;
            totalEarned: number;
            totalSpent: number;
            orderCount: number;
            couponCount: number;
            redemptionCount: number;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    detail(id: number, user: JwtPayload): Promise<{
        profile: {
            openid: string;
            unionid: string;
            id: number;
            phone: string;
            nickname: string;
            avatar: string;
            status: import(".prisma/client").$Enums.UserStatus;
            registeredAt: Date;
            createdAt: Date;
        };
        account: {
            balance: number;
            totalEarned: number;
            totalSpent: number;
        };
        coupons: {
            code: string;
            id: number;
            status: import(".prisma/client").$Enums.CouponInstanceStatus;
            templateId: number;
            issuerMerchantId: number;
            obtainedAt: Date;
            expireAt: Date;
        }[];
        orders: {
            merchantId: number;
            storeId: number;
            id: number;
            status: import(".prisma/client").$Enums.OrderStatus;
            orderNo: string;
            payAmount: Prisma.Decimal;
            consumeTime: Date;
        }[];
        redemptions: {
            code: string;
            merchantId: number;
            storeId: number;
            id: number;
            status: import(".prisma/client").$Enums.RedemptionStatus;
            redeemedAt: Date;
        }[];
        sourceMerchants: {
            type: import(".prisma/client").$Enums.MerchantType;
            id: number;
            name: string;
        }[];
    }>;
    updateStatus(id: number, user: JwtPayload, dto: UpdateUserStatusDto, ip?: string, ua?: string): Promise<{
        id: number;
        status: import(".prisma/client").$Enums.UserStatus;
        unchanged: boolean;
    }>;
    bindPhone(id: number, user: JwtPayload, dto: BindPhoneDto, ip?: string, ua?: string): Promise<{
        id: number;
        phone: string;
        unchanged: boolean;
    }>;
}
