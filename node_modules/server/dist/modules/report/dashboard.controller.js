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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const report_dto_1 = require("./dto/report.dto");
const report_service_1 = require("./report.service");
let DashboardController = class DashboardController {
    constructor(reports) {
        this.reports = reports;
    }
    stats(user) {
        return this.reports.stats(user);
    }
    trend(q, user) {
        return this.reports.trend(q, user);
    }
    todo(user) {
        return this.reports.todo(user);
    }
    distribution(user) {
        return this.reports.distribution(user);
    }
    topMerchants(user) {
        return this.reports.topMerchants(user);
    }
    galaxy(user) {
        return this.reports.galaxy(user);
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)('stats'),
    (0, roles_decorator_1.Permissions)('dashboard:view'),
    (0, swagger_1.ApiOperation)({ summary: '工作台卡片（今日订单 / 核销 / 兑换 / 发券，含环比）' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "stats", null);
__decorate([
    (0, common_1.Get)('trend'),
    (0, roles_decorator_1.Permissions)('dashboard:view'),
    (0, swagger_1.ApiOperation)({ summary: '近 N 天趋势（订单 / 核销 / 兑换），days 默认 7' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_dto_1.TrendQueryDto, Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "trend", null);
__decorate([
    (0, common_1.Get)('todo'),
    (0, roles_decorator_1.Permissions)('dashboard:view'),
    (0, swagger_1.ApiOperation)({ summary: '待办数量：待审商家 / 异常订单 / 未读通知' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "todo", null);
__decorate([
    (0, common_1.Get)('distribution'),
    (0, roles_decorator_1.Permissions)('dashboard:view'),
    (0, swagger_1.ApiOperation)({ summary: '分布：券类型分布 + 积分来源分布（隔离到角色视角）' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "distribution", null);
__decorate([
    (0, common_1.Get)('top-merchants'),
    (0, roles_decorator_1.Permissions)('dashboard:view'),
    (0, swagger_1.ApiOperation)({ summary: '交易额 Top5 商家（仅平台/主体可见，附属/店员返回空）' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "topMerchants", null);
__decorate([
    (0, common_1.Get)('galaxy'),
    (0, roles_decorator_1.Permissions)('dashboard:view'),
    (0, swagger_1.ApiOperation)({
        summary: '星系视图：中心商家 + 环绕附属（大小=本月交易额，颜色=状态）+ 交易额边',
        description: '平台/主体可用；**附属/店员返回 403 FORBIDDEN_SCOPE**（前端据此降级为数据视图）。',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "galaxy", null);
exports.DashboardController = DashboardController = __decorate([
    (0, swagger_1.ApiTags)('dashboard'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('dashboard'),
    __metadata("design:paramtypes", [report_service_1.ReportService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map