import type { Request } from 'express';
import { RequestScope } from '../../common/guards/merchant-scope.guard';
import { SubService } from './sub.service';
export declare class SubController {
    private readonly sub;
    constructor(sub: SubService);
    listStores(req: Request & {
        scope: RequestScope;
    }, keyword?: string): import(".prisma/client").Prisma.PrismaPromise<{
        code: string;
        merchantId: number;
        id: number;
        status: import(".prisma/client").$Enums.StoreStatus;
        name: string;
        contactName: string;
        contactPhone: string;
        address: string;
    }[]>;
    getStore(req: Request & {
        scope: RequestScope;
    }, id: number): Promise<{
        code: string;
        merchantId: number;
        id: number;
        status: import(".prisma/client").$Enums.StoreStatus;
        name: string;
        contactName: string;
        contactPhone: string;
        province: string;
        city: string;
        district: string;
        address: string;
        lng: import("@prisma/client/runtime/library").Decimal;
        lat: import("@prisma/client/runtime/library").Decimal;
        businessHours: string;
        logo: string;
    }>;
}
