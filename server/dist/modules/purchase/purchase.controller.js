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
exports.PurchaseController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const purchase_dto_1 = require("./dto/purchase.dto");
const purchase_service_1 = require("./purchase.service");
let PurchaseController = class PurchaseController {
    constructor(purchases) {
        this.purchases = purchases;
    }
    list(query, user) {
        return this.purchases.list(query, user);
    }
    create(dto, user) {
        return this.purchases.create(dto, user);
    }
    settle(id, dto, user) {
        return this.purchases.settle(id, dto, user);
    }
};
exports.PurchaseController = PurchaseController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Permissions)('purchase:view'),
    (0, swagger_1.ApiOperation)({ summary: '采购记录列表（主体全量 / 附属只看自己作为 sub 的）' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [purchase_dto_1.QueryPurchasesDto, Object]),
    __metadata("design:returntype", void 0)
], PurchaseController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Permissions)('purchase:create'),
    (0, swagger_1.ApiOperation)({ summary: '新增采购记录（purchaseNo 自动生成）' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [purchase_dto_1.CreatePurchaseDto, Object]),
    __metadata("design:returntype", void 0)
], PurchaseController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id/settle'),
    (0, roles_decorator_1.Permissions)('purchase:settle'),
    (0, swagger_1.ApiOperation)({ summary: '标记已结算（UNSETTLED → SETTLED，不可回退）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, purchase_dto_1.SettlePurchaseDto, Object]),
    __metadata("design:returntype", void 0)
], PurchaseController.prototype, "settle", null);
exports.PurchaseController = PurchaseController = __decorate([
    (0, swagger_1.ApiTags)('purchases'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchases'),
    __metadata("design:paramtypes", [purchase_service_1.PurchaseService])
], PurchaseController);
//# sourceMappingURL=purchase.controller.js.map