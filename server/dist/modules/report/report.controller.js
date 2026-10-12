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
exports.ReportController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const report_dto_1 = require("./dto/report.dto");
const report_service_1 = require("./report.service");
let ReportController = class ReportController {
    constructor(reports) {
        this.reports = reports;
    }
    merchantOnboarding(q, user) {
        return this.reports.merchantOnboarding(q, user);
    }
    ordersSummary(q, user) {
        return this.reports.ordersSummary(q, user);
    }
    couponSummary(q, user) {
        return this.reports.couponSummary(q, user);
    }
    pointsSummary(q, user) {
        return this.reports.pointsSummary(q, user);
    }
    storeSettlement(q, user) {
        return this.reports.storeSettlement(q, user);
    }
    authorizationLogs(q, user) {
        return this.reports.authorizationLogs(q, user);
    }
    async export(param, q, user, res) {
        const csv = await this.reports.exportCsv(param.key, q, user);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="report-${param.key}.csv"`);
        return csv;
    }
};
exports.ReportController = ReportController;
__decorate([
    (0, common_1.Get)('merchant-onboarding'),
    (0, roles_decorator_1.Permissions)('report:view'),
    (0, swagger_1.ApiOperation)({ summary: '商户入驻报表：按状态汇总 + 按月新增趋势' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_dto_1.ReportQueryDto, Object]),
    __metadata("design:returntype", void 0)
], ReportController.prototype, "merchantOnboarding", null);
__decorate([
    (0, common_1.Get)('orders-summary'),
    (0, roles_decorator_1.Permissions)('report:view'),
    (0, swagger_1.ApiOperation)({ summary: '全平台订单汇总：金额合计 + 按状态 + 按商家 + 按日趋势' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_dto_1.ReportQueryDto, Object]),
    __metadata("design:returntype", void 0)
], ReportController.prototype, "ordersSummary", null);
__decorate([
    (0, common_1.Get)('coupon-summary'),
    (0, roles_decorator_1.Permissions)('report:view'),
    (0, swagger_1.ApiOperation)({ summary: '代金券汇总：按状态 + 按模板 + 核销率' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_dto_1.ReportQueryDto, Object]),
    __metadata("design:returntype", void 0)
], ReportController.prototype, "couponSummary", null);
__decorate([
    (0, common_1.Get)('points-summary'),
    (0, roles_decorator_1.Permissions)('report:view'),
    (0, swagger_1.ApiOperation)({ summary: '积分流水汇总：按类型 + 净变动' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_dto_1.ReportQueryDto, Object]),
    __metadata("design:returntype", void 0)
], ReportController.prototype, "pointsSummary", null);
__decorate([
    (0, common_1.Get)('store-settlement'),
    (0, roles_decorator_1.Permissions)('report:view'),
    (0, swagger_1.ApiOperation)({ summary: '采购核销对账：采购额 vs 核销额 + 按商家差额' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_dto_1.ReportQueryDto, Object]),
    __metadata("design:returntype", void 0)
], ReportController.prototype, "storeSettlement", null);
__decorate([
    (0, common_1.Get)('authorization-logs'),
    (0, roles_decorator_1.Permissions)('report:view'),
    (0, swagger_1.ApiOperation)({ summary: '授权记录：主体→附属授权明细（含撤销原因、模板范围）' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_dto_1.ReportQueryDto, Object]),
    __metadata("design:returntype", void 0)
], ReportController.prototype, "authorizationLogs", null);
__decorate([
    (0, common_1.Get)(':key/export'),
    (0, roles_decorator_1.Permissions)('report:export'),
    (0, swagger_1.ApiOperation)({ summary: '报表 CSV 导出（UTF-8 BOM + 引号转义，筛选条件与页面一致）' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_dto_1.ReportKeyParamDto,
        report_dto_1.ReportQueryDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "export", null);
exports.ReportController = ReportController = __decorate([
    (0, swagger_1.ApiTags)('reports'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('reports'),
    __metadata("design:paramtypes", [report_service_1.ReportService])
], ReportController);
//# sourceMappingURL=report.controller.js.map