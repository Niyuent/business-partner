"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementCronService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const settlement_service_1 = require("./settlement.service");
let SettlementCronService = class SettlementCronService {
    constructor(prisma, settlements) {
        this.prisma = prisma;
        this.settlements = settlements;
        this.logger = new common_1.Logger('SettlementCron');
    }
    onModuleInit() {
        this.logger.log('对账单定时任务已注册：每月 1 日 00:00（Asia/Shanghai）生成上月对账单');
    }
    async handleMonthly() {
        this.logger.log('对账单定时任务开始：生成上月对账单');
        const now = new Date();
        const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const subs = await this.prisma.merchant.findMany({
            where: { type: client_1.MerchantType.SUB },
            select: { id: true, name: true },
        });
        let generated = 0;
        let skipped = 0;
        for (const sub of subs) {
            try {
                const res = await this.settlements.generate({ merchantId: sub.id, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() });
                if (res.idempotent)
                    skipped++;
                else
                    generated++;
            }
            catch (e) {
                this.logger.error(`生成 ${sub.name}(#${sub.id}) 对账单失败：${e.message}`);
            }
        }
        this.logger.log(`对账单定时任务完成：新建 ${generated} 份，已存在跳过 ${skipped} 份`);
    }
};
exports.SettlementCronService = SettlementCronService;
__decorate([
    (0, schedule_1.Cron)('0 0 1 * *', { timeZone: 'Asia/Shanghai' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettlementCronService.prototype, "handleMonthly", null);
exports.SettlementCronService = SettlementCronService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        settlement_service_1.SettlementService])
], SettlementCronService);
//# sourceMappingURL=settlement-cron.service.js.map