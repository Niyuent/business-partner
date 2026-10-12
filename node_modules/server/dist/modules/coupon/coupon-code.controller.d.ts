import { JwtPayload } from '../auth/jwt-payload';
import { CouponCodeService } from './coupon-code.service';
import { GenerateCodesDto, QueryCodesDto } from './dto/coupon-code.dto';
export declare class CouponCodeController {
    private readonly codes;
    constructor(codes: CouponCodeService);
    generate(id: number, dto: GenerateCodesDto, user: JwtPayload, ip: string, ua: string): Promise<{
        batchNo: string;
        batchId: number;
        templateId: number;
        quantity: number;
        codes: string[];
    }>;
    list(id: number, query: QueryCodesDto, user: JwtPayload): Promise<{
        list: import("./coupon-code.service").CouponCodeView[];
        total: number;
        page: number;
        pageSize: number;
        stats: {
            unused: number;
            issued: number;
            redeemed: number;
        };
    }>;
    batches(id: number, user: JwtPayload): Promise<{
        list: {
            id: number;
            batchNo: string;
            templateId: number;
            quantity: number;
            actualCount: number;
            stats: {
                UNISSUED: number;
                ISSUED: number;
                REDEEMED: number;
                VOID: number;
            };
            remark: string;
            operatorId: number;
            operatorName: string;
            createdAt: Date;
        }[];
    }>;
}
