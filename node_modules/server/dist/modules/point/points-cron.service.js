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
exports.PointsCronService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const point_service_1 = require("./point.service");
let PointsCronService = class PointsCronService {
    constructor(points) {
        this.points = points;
        this.logger = new common_1.Logger('PointsCron');
    }
    onModuleInit() {
        this.logger.log('积分过期清零定时任务已注册：每天 01:00（Asia/Shanghai）执行');
    }
    async handlePointsExpire() {
        this.logger.log('积分过期清零定时任务开始');
        try {
            const res = await this.points.expirePoints({ triggeredBy: 'cron' });
            this.logger.log(`积分过期清零定时任务完成：处理 ${res.processed} 笔，过期 ${res.expiredAmount} 分` +
                (res.skipped ? '（本次被跳过：已有任务在执行）' : ''));
        }
        catch (e) {
            this.logger.error(`积分过期清零定时任务失败：${e.message}`);
        }
    }
};
exports.PointsCronService = PointsCronService;
__decorate([
    (0, schedule_1.Cron)('0 1 * * *', { timeZone: 'Asia/Shanghai' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PointsCronService.prototype, "handlePointsExpire", null);
exports.PointsCronService = PointsCronService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [point_service_1.PointService])
], PointsCronService);
//# sourceMappingURL=points-cron.service.js.map