import { CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
export interface RequestScope {
    merchantId: number | null;
    storeId: number | null;
    userType: 'PLATFORM' | 'MERCHANT' | 'STORE';
    userId: number;
    isPlatform: boolean;
}
export declare class MerchantScopeGuard implements CanActivate {
    private readonly reflector;
    private readonly logger;
    constructor(reflector: Reflector);
    canActivate(context: ExecutionContext): boolean;
    private isSubRoute;
}
export declare function scopedWhere(scope: Pick<RequestScope, 'merchantId' | 'storeId' | 'isPlatform'>): {
    merchantId?: number;
    storeId?: number;
};
export { UnauthorizedException };
