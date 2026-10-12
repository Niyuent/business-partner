import { JwtPayload } from '../auth/jwt-payload';
import { CreatePurchaseDto, QueryPurchasesDto, SettlePurchaseDto } from './dto/purchase.dto';
import { PurchaseService } from './purchase.service';
export declare class PurchaseController {
    private readonly purchases;
    constructor(purchases: PurchaseService);
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
}
