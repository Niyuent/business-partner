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
exports.SettlementController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const settlement_dto_1 = require("./dto/settlement.dto");
const settlement_service_1 = require("./settlement.service");
let SettlementController = class SettlementController {
    constructor(settlements) {
        this.settlements = settlements;
    }
    async generate(dto, user, res) {
        const result = await this.settlements.generate(dto, user);
        if (result.idempotent) {
            res.status(common_1.HttpStatus.OK);
        }
        return result;
    }
    list(query, user) {
        return this.settlements.list(query, user);
    }
    detail(id, user) {
        return this.settlements.detail(id, user);
    }
    confirm(id, dto, user) {
        return this.settlements.confirm(id, dto, user);
    }
    async export(id, user, res) {
        const csv = await this.settlements.exportCsv(id, user);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="settlement-${id}.csv"`);
        return csv;
    }
};
exports.SettlementController = SettlementController;
__decorate([
    (0, common_1.Post)('generate'),
    (0, roles_decorator_1.Permissions)('settlement:generate'),
    (0, swagger_1.ApiOperation)({ summary: '生成对账单（周期 + 商家，幂等）' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [settlement_dto_1.GenerateSettlementDto, Object, Object]),
    __metadata("design:returntype", Promise)
], SettlementController.prototype, "generate", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Permissions)('settlement:view'),
    (0, swagger_1.ApiOperation)({ summary: '对账单列表（附属只看自己）' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [settlement_dto_1.QuerySettlementsDto, Object]),
    __metadata("design:returntype", void 0)
], SettlementController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Permissions)('settlement:view'),
    (0, swagger_1.ApiOperation)({ summary: '对账单详情（采购明细 + 核销明细）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], SettlementController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)(':id/confirm'),
    (0, roles_decorator_1.Permissions)('settlement:confirm'),
    (0, swagger_1.ApiOperation)({ summary: '确认或提异议（GENERATED → CONFIRMED/DISPUTED）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, settlement_dto_1.ConfirmSettlementDto, Object]),
    __metadata("design:returntype", void 0)
], SettlementController.prototype, "confirm", null);
__decorate([
    (0, common_1.Get)(':id/export'),
    (0, roles_decorator_1.Permissions)('settlement:view'),
    (0, swagger_1.ApiOperation)({ summary: '导出核销明细 CSV（UTF-8 BOM）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], SettlementController.prototype, "export", null);
exports.SettlementController = SettlementController = __decorate([
    (0, swagger_1.ApiTags)('settlements'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('settlements'),
    __metadata("design:paramtypes", [settlement_service_1.SettlementService])
], SettlementController);
//# sourceMappingURL=settlement.controller.js.map