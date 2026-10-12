import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit-log/audit.service';
import { JwtPayload } from '../auth/jwt-payload';
import { CreatePurchaseDto, QueryPurchasesDto, SettlePurchaseDto } from './dto/purchase.dto';
export declare class PurchaseService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(query: QueryPurchasesDto, user: JwtPayload): Promise<{
        list: {
            id: number;
            purchaseNo: string;
            mainMerchantId: number;
            mainMerchantName: string;
            subMerchantId: number;
            subMerchantName: string;
            templateId: number;
            templateName: string;
            quantity: number;
            unitPrice: number;
            totalAmount: number;
            settleStatus: import(".prisma/client").$Enums.SettleStatus;
            settleRemark: string;
            purchasedAt: Date;
            createdAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    create(dto: CreatePurchaseDto, user: JwtPayload): Promise<{
        id: any;
        purchaseNo: any;
        totalAmount: number;
        settleStatus: any;
    }>;
    settle(id: number, dto: SettlePurchaseDto, user: JwtPayload): Promise<{
        id: number;
        settleStatus: import(".prisma/client").$Enums.SettleStatus;
        settleRemark: string;
    }>;
    private resolveParties;
    private purchaseScope;
    private visibleSubMerchantIds;
    private assertSettleAllowed;
    private nextPurchaseNo;
}
