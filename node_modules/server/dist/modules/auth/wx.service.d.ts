export interface WxSession {
    openid: string;
    unionid: string | null;
}
export declare class WxService {
    private readonly logger;
    private readonly mode;
    private readonly appid;
    private readonly secret;
    constructor();
    get isMock(): boolean;
    private isInternalIp;
    code2session(code: string, ip?: string): Promise<WxSession>;
}
