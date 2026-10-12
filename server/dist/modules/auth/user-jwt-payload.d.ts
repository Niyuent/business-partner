export interface UserJwtPayload {
    kind: 'USER';
    sub: number;
    userId: number;
    openid: string;
    unionid: string | null;
}
