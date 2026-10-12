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
exports.CouponInstanceController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const coupon_instance_service_1 = require("./coupon-instance.service");
const coupon_instance_dto_1 = require("./dto/coupon-instance.dto");
let CouponInstanceController = class CouponInstanceController {
    constructor(instances) {
        this.instances = instances;
    }
    issue(dto, user, ip, ua) {
        return this.instances.issue(dto, user, ip, ua);
    }
    list(query, user) {
        return this.instances.list(query, user);
    }
    detail(id, user) {
        return this.instances.detail(id, user);
    }
    freeze(id, dto, user, ip, ua) {
        return this.instances.freeze(id, dto, user, ip, ua);
    }
};
exports.CouponInstanceController = CouponInstanceController;
__decorate([
    (0, common_1.Post)('issue'),
    (0, roles_decorator_1.Permissions)('coupon:issue-main', 'coupon:issue'),
    (0, swagger_1.ApiOperation)({
        summary: '发放券实例（核心：接 checkAuthorization）',
        description: '流程：① 授权/状态校验（403 SUB_MERCHANT_NOT_AUTHORIZED / CAN_ONLY_ISSUE_MAIN_COUPON / TEMPLATE_NOT_IN_AUTHORIZED_SCOPE / TEMPLATE_NOT_AVAILABLE）→ ② 库存条件更新（409 STOCK_EXHAUSTED）→ ③ 券码 FOR UPDATE 取用（409 CODE_POOL_EXHAUSTED）→ ④ 建实例 + 绑码 → ⑤ 同事务写审计 coupon:issue。',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [coupon_instance_dto_1.IssueCouponDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], CouponInstanceController.prototype, "issue", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Permissions)('coupon:instance:view'),
    (0, swagger_1.ApiOperation)({
        summary: '券实例列表（模板 / 用户 / 状态 / 有效期筛选，分页）',
        description: '数据隔离：主体看自己拥有或创建的模板下的券，附属只看自己发放或自己拥有的。',
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [coupon_instance_dto_1.QueryInstancesDto, Object]),
    __metadata("design:returntype", void 0)
], CouponInstanceController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Permissions)('coupon:instance:view'),
    (0, swagger_1.ApiOperation)({ summary: '券实例详情（含适用门店）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CouponInstanceController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)(':id/freeze'),
    (0, roles_decorator_1.Permissions)('coupon:instance:freeze'),
    (0, swagger_1.ApiOperation)({ summary: '冻结 / 解冻券实例（frozen=true 冻结）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __param(4, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, coupon_instance_dto_1.FreezeInstanceDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], CouponInstanceController.prototype, "freeze", null);
exports.CouponInstanceController = CouponInstanceController = __decorate([
    (0, swagger_1.ApiTags)('coupon-instances'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('coupon-instances'),
    __metadata("design:paramtypes", [coupon_instance_service_1.CouponInstanceService])
], CouponInstanceController);
//# sourceMappingURL=coupon-instance.controller.js.map