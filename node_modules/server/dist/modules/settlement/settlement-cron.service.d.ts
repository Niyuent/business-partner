import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SettlementService } from './settlement.service';
export declare class SettlementCronService implements OnModuleInit {
    private readonly prisma;
    private readonly settlements;
    private readonly logger;
    constructor(prisma: PrismaService, settlements: SettlementService);
    onModuleInit(): void;
    handleMonthly(): Promise<void>;
}
