import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { WxService } from './wx.service';
export interface LoginResult {
    accessToken: string;
    expiresIn: string;
    user: {
        id: number;
        username: string;
        realName: string | null;
        phone: string | null;
        userType: string;
        merchantId: number | null;
        merchantName: string | null;
        storeId: number | null;
        storeName: string | null;
        lastLoginAt: Date | null;
    };
    roles: string[];
    permissions: string[];
    mustChangePassword: boolean;
}
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    private readonly wx;
    private readonly logger;
    constructor(prisma: PrismaService, jwt: JwtService, wx: WxService);
    userLogin(code: string, ip?: string): Promise<{
        accessToken: string;
        expiresIn: string;
        user: {
            id: number;
            nickname: string;
            phone: string;
            openid: string;
            unionid: string;
        };
    }>;
    login(username: string, password: string, ip?: string): Promise<LoginResult>;
    profile(userId: number): Promise<{
        id: number;
        username: string;
        realName: string;
        phone: string;
        userType: import(".prisma/client").$Enums.AdminUserType;
        status: import(".prisma/client").$Enums.UserStatus;
        lastLoginAt: Date;
        merchant: {
            code: string;
            type: import(".prisma/client").$Enums.MerchantType;
            id: number;
            status: import(".prisma/client").$Enums.MerchantStatus;
            name: string;
        };
        store: {
            id: number;
            name: string;
        };
        roles: string[];
        permissions: string[];
    }>;
    permissions(userId: number): Promise<{
        roles: string[];
        permissions: string[];
    }>;
    updatePassword(userId: number, dto: UpdatePasswordDto): Promise<{
        updated: boolean;
        mustChangePassword: boolean;
    }>;
    private loadGrants;
}
