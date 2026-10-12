export interface JwtPayload {
    sub: number;
    username: string;
    merchantId: number | null;
    storeId: number | null;
    userType: 'PLATFORM' | 'MERCHANT' | 'STORE';
    roles?: string[];
    permissions?: string[];
}
