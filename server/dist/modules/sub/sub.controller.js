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
exports.SubController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const merchant_scope_guard_1 = require("../../common/guards/merchant-scope.guard");
const sub_service_1 = require("./sub.service");
let SubController = class SubController {
    constructor(sub) {
        this.sub = sub;
    }
    listStores(req, keyword) {
        return this.sub.listStores(req.scope, keyword);
    }
    getStore(req, id) {
        return this.sub.getStore(req.scope, id);
    }
};
exports.SubController = SubController;
__decorate([
    (0, common_1.Get)('stores'),
    (0, roles_decorator_1.Permissions)('store:view'),
    (0, swagger_1.ApiOperation)({
        summary: '【SCOPED】查看本商家的门店列表',
        description: '数据范围由 JWT 强制锁定。显式传 merchantId 且不等于自身归属时返回 403 FORBIDDEN_SCOPE。',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('keyword')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SubController.prototype, "listStores", null);
__decorate([
    (0, common_1.Get)('stores/:id'),
    (0, roles_decorator_1.Permissions)('store:view'),
    (0, swagger_1.ApiOperation)({
        summary: '【SCOPED】查看门店详情',
        description: '不属于本商家时返回 404 RESOURCE_NOT_FOUND（不泄露该门店是否存在）。',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], SubController.prototype, "getStore", null);
exports.SubController = SubController = __decorate([
    (0, swagger_1.ApiTags)('sub'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('sub'),
    (0, common_1.UseGuards)(merchant_scope_guard_1.MerchantScopeGuard),
    __metadata("design:paramtypes", [sub_service_1.SubService])
], SubController);
//# sourceMappingURL=sub.controller.js.map