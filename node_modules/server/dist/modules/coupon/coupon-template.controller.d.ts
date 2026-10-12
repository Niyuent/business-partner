import { JwtPayload } from '../auth/jwt-payload';
import { CouponTemplateService } from './coupon-template.service';
import { CreateCouponTemplateDto, QueryCouponTemplatesDto, UpdateCouponTemplateDto } from './dto/coupon-template.dto';
export declare class CouponTemplateController {
    private readonly templates;
    constructor(templates: CouponTemplateService);
    list(query: QueryCouponTemplatesDto, user: JwtPayload): Promise<{
        list: {
            instanceStats: {
                issuedCount: number;
                usedCount: number;
                unusedCount: number;
                frozenCount: number;
                expiredCount: number;
                drift: {
                    issued: boolean;
                    used: boolean;
                };
            };
            id: number;
            name: string;
            subtitle: string | null;
            ownerType: string;
            ownerMerchantId: number;
            ownerMerchantName: string | null;
            creatorMerchantId: number;
            couponType: string;
            faceValue: number;
            thresholdAmount: number;
            pointsCost: number;
            purchasePrice: number;
            totalStock: number;
            issuedCount: number;
            usedCount: number;
            remainingStock: number;
            validType: string;
            validStart: Date | null;
            validEnd: Date | null;
            validDays: number;
            applyScope: string;
            storeIds: number[];
            stores: Array<{
                id: number;
                name: string;
            }>;
            perUserLimit: number;
            status: import(".prisma/client").CouponTemplateStatus;
            editable: boolean;
            description: string | null;
            rules: string | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    detail(id: number, user: JwtPayload): Promise<{
        stats: {
            codes: Record<string, number>;
            instances: Record<string, number>;
        };
        id: number;
        name: string;
        subtitle: string | null;
        ownerType: string;
        ownerMerchantId: number;
        ownerMerchantName: string | null;
        creatorMerchantId: number;
        couponType: string;
        faceValue: number;
        thresholdAmount: number;
        pointsCost: number;
        purchasePrice: number;
        totalStock: number;
        issuedCount: number;
        usedCount: number;
        remainingStock: number;
        validType: string;
        validStart: Date | null;
        validEnd: Date | null;
        validDays: number;
        applyScope: string;
        storeIds: number[];
        stores: Array<{
            id: number;
            name: string;
        }>;
        perUserLimit: number;
        status: import(".prisma/client").CouponTemplateStatus;
        editable: boolean;
        description: string | null;
        rules: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    create(dto: CreateCouponTemplateDto, user: JwtPayload, ip: string, ua: string): Promise<{
        template: import("./coupon-template.service").CouponTemplateView;
    }>;
    update(id: number, dto: UpdateCouponTemplateDto, user: JwtPayload, ip: string, ua: string): Promise<{
        template: import("./coupon-template.service").CouponTemplateView;
    }>;
    publish(id: number, user: JwtPayload, ip: string, ua: string): Promise<{
        template: import("./coupon-template.service").CouponTemplateView;
    }>;
    unpublish(id: number, user: JwtPayload, ip: string, ua: string): Promise<{
        template: import("./coupon-template.service").CouponTemplateView;
    }>;
}
