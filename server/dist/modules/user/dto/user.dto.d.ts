import { UserStatus } from '@prisma/client';
export declare class QueryUsersDto {
    page?: number;
    pageSize?: number;
    phone?: string;
    keyword?: string;
    status?: UserStatus;
    registeredFrom?: string;
    registeredTo?: string;
}
export declare class UpdateUserStatusDto {
    status: UserStatus;
}
export declare class BindPhoneDto {
    phone: string;
}
