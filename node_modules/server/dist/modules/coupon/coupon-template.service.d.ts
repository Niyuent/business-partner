import { CouponOwnerType, CouponTemplateStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit-log/audit.service';
import { JwtPayload } from '../auth/jwt-payload';
import { CreateCouponTemplateDto, QueryCouponTemplatesDto, UpdateCouponTemplateDto } from './dto/coupon-template.dto';
export interface CouponTemplateView {
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
    status: CouponTemplateStatus;
    editable: boolean;
    description: string | null;
    rules: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare class CouponTemplateService {
    private readonly prisma;
    private readonly audit;
    private readonly logger;
    constructor(prisma: PrismaService, audit: AuditService);
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
            status: CouponTemplateStatus;
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
        status: CouponTemplateStatus;
        editable: boolean;
        description: string | null;
        rules: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    create(dto: CreateCouponTemplateDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        template: CouponTemplateView;
    }>;
    update(id: number, dto: UpdateCouponTemplateDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        template: CouponTemplateView;
    }>;
    publish(id: number, user: JwtPayload, ip?: string, ua?: string): Promise<{
        template: CouponTemplateView;
    }>;
    unpublish(id: number, user: JwtPayload, ip?: string, ua?: string): Promise<{
        template: CouponTemplateView;
    }>;
    private changeStatus;
    private resolveMainMerchant;
    private resolveOwner;
    private buildVisibleWhere;
    private authorizedCondition;
    assertVisible(template: {
        id: number;
        ownerMerchantId: number;
        creatorMerchantId: number;
        ownerType: CouponOwnerType;
        status: CouponTemplateStatus;
    }, user: JwtPayload): Promise<void>;
    assertOwnedByMyMain(template: {
        id: number;
        ownerMerchantId: number;
        creatorMerchantId: number;
    }, user: JwtPayload): Promise<void>;
    private assertEditable;
    private assertValidPeriod;
    private normalize;
    private merge;
    private buildValidity;
    private assertStores;
    private toView;
    private snapshot;
}
