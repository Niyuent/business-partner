import { RateLimitService } from '../../common/services/rate-limit.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UserLoginDto } from './dto/user-login.dto';
import { JwtPayload } from './jwt-payload';
export declare class AuthController {
    private readonly auth;
    private readonly rateLimit;
    constructor(auth: AuthService, rateLimit: RateLimitService);
    login(dto: LoginDto, ip: string): Promise<import("./auth.service").LoginResult>;
    userLogin(dto: UserLoginDto, ip: string): Promise<{
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
    profile(user: JwtPayload): Promise<{
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
    permissions(user: JwtPayload): Promise<{
        roles: string[];
        permissions: string[];
    }>;
    updatePassword(user: JwtPayload, dto: UpdatePasswordDto): Promise<{
        updated: boolean;
        mustChangePassword: boolean;
    }>;
}
