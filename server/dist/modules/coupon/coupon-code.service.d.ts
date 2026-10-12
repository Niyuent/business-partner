import { CouponCodeStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit-log/audit.service';
import { JwtPayload } from '../auth/jwt-payload';
import { CouponTemplateService } from './coupon-template.service';
import { GenerateCodesDto, QueryCodesDto } from './dto/coupon-code.dto';
export interface CouponCodeView {
    id: number;
    code: string;
    batchNo: string;
    batchId: number | null;
    templateId: number;
    status: CouponCodeStatus;
    instanceId: number | null;
    generatedAt: Date;
}
export declare class CouponCodeService {
    private readonly prisma;
    private readonly audit;
    private readonly templates;
    private readonly logger;
    constructor(prisma: PrismaService, audit: AuditService, templates: CouponTemplateService);
    generate(templateId: number, dto: GenerateCodesDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        batchNo: string;
        batchId: number;
        templateId: number;
        quantity: number;
        codes: string[];
    }>;
    list(templateId: number, query: QueryCodesDto, user: JwtPayload): Promise<{
        list: CouponCodeView[];
        total: number;
        page: number;
        pageSize: number;
        stats: {
            unused: number;
            issued: number;
            redeemed: number;
        };
    }>;
    batches(templateId: number, user: JwtPayload): Promise<{
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
    private nextBatchNo;
    private isUniqueViolation;
}
