export declare const CODE_LENGTH = 12;
export declare const CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export declare function checkChar(payload: string): string;
export declare function generateCouponCode(): string;
export declare function generateCouponCodes(count: number): string[];
export declare function isValidCouponCode(code: string): boolean;
