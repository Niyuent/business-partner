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
exports.StoreChangeController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const store_change_dto_1 = require("./dto/store-change.dto");
const store_change_service_1 = require("./store-change.service");
let StoreChangeController = class StoreChangeController {
    constructor(service) {
        this.service = service;
    }
    listForReview(query, user) {
        return this.service.listForReview(query, user);
    }
    detail(id, user) {
        return this.service.detail(id, user);
    }
    review(id, dto, user, ip, ua) {
        return this.service.review(id, dto, user, ip, ua);
    }
    cancel(id, user, ip, ua) {
        return this.service.cancel(id, user, ip, ua);
    }
    submit(id, dto, req, user, ip, ua) {
        return this.service.submit(id, dto, user, req.body, ip, ua);
    }
    listForStore(id, user) {
        return this.service.listForStore(id, user);
    }
};
exports.StoreChangeController = StoreChangeController;
__decorate([
    (0, common_1.Get)('change-requests'),
    (0, roles_decorator_1.Permissions)('store:change:review'),
    (0, swagger_1.ApiOperation)({ summary: '门店变更申请列表（主体/平台审核用）' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [store_change_dto_1.QueryStoreChangeDto, Object]),
    __metadata("design:returntype", void 0)
], StoreChangeController.prototype, "listForReview", null);
__decorate([
    (0, common_1.Get)('change-requests/:id'),
    (0, roles_decorator_1.Permissions)('store:change:review'),
    (0, swagger_1.ApiOperation)({ summary: '门店变更申请详情（含变更前后对比）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], StoreChangeController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)('change-requests/:id/review'),
    (0, roles_decorator_1.Permissions)('store:change:review'),
    (0, swagger_1.ApiOperation)({ summary: '审核门店变更申请（通过 / 驳回；驳回必填 remark）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __param(4, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, store_change_dto_1.ReviewStoreChangeDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], StoreChangeController.prototype, "review", null);
__decorate([
    (0, common_1.Post)('change-requests/:id/cancel'),
    (0, roles_decorator_1.Permissions)('store:change:submit'),
    (0, swagger_1.ApiOperation)({ summary: '作废本店的待审核申请（申请不可修改，只能作废后重新提交）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String, String]),
    __metadata("design:returntype", void 0)
], StoreChangeController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)(':id/change-requests'),
    (0, roles_decorator_1.Permissions)('store:change:submit'),
    (0, swagger_1.ApiOperation)({
        summary: '提交门店变更申请（仅限本商家/本门店；白名单字段）',
        description: '可变更：名称/联系人/电话/省市区/地址/经纬度/营业时间/logo。禁止变更：门店编码 code、所属商家 merchantId、门店状态 status（夹带即 400）。',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __param(4, (0, common_1.Ip)()),
    __param(5, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, store_change_dto_1.CreateStoreChangeDto, Object, Object, String, String]),
    __metadata("design:returntype", void 0)
], StoreChangeController.prototype, "submit", null);
__decorate([
    (0, common_1.Get)(':id/change-requests'),
    (0, roles_decorator_1.Permissions)('store:change:submit'),
    (0, swagger_1.ApiOperation)({ summary: '查看本门店的变更申请（含状态）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], StoreChangeController.prototype, "listForStore", null);
exports.StoreChangeController = StoreChangeController = __decorate([
    (0, swagger_1.ApiTags)('stores'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('stores'),
    __metadata("design:paramtypes", [store_change_service_1.StoreChangeService])
], StoreChangeController);
//# sourceMappingURL=store.controller.js.map