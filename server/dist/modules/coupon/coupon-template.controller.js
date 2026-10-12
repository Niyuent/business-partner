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
exports.CouponTemplateController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const coupon_template_service_1 = require("./coupon-template.service");
const coupon_template_dto_1 = require("./dto/coupon-template.dto");
let CouponTemplateController = class CouponTemplateController {
    constructor(templates) {
        this.templates = templates;
    }
    list(query, user) {
        return this.templates.list(query, user);
    }
    detail(id, user) {
        return this.templates.detail(id, user);
    }
    create(dto, user, ip, ua) {
        return this.templates.create(dto, user, ip, ua);
    }
    update(id, dto, user, ip, ua) {
        return this.templates.update(id, dto, user, ip, ua);
    }
    publish(id, user, ip, ua) {
        return this.templates.publish(id, user, ip, ua);
    }
    unpublish(id, user, ip, ua) {
        return this.templates.unpublish(id, user, ip, ua);
    }
};
exports.CouponTemplateController = CouponTemplateController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Permissions)('coupon:view'),
    (0, swagger_1.ApiOperation)({
        summary: '券模板列表（分页 + 筛选）',
        description: '按调用方身份收敛可见范围：主体看自己创建/拥有，附属看自己拥有 + 授权范围内的已上架主体券。',
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [coupon_template_dto_1.QueryCouponTemplatesDto, Object]),
    __metadata("design:returntype", void 0)
], CouponTemplateController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Permissions)('coupon:view'),
    (0, swagger_1.ApiOperation)({
        summary: '券模板详情（含券码与券实例统计）',
        description: '不在可见范围内的模板一律 404（不暴露存在性）。',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CouponTemplateController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Permissions)('coupon:create'),
    (0, swagger_1.ApiOperation)({
        summary: '创建券模板（H1：创建者必须是主体商家）',
        description: 'creatorMerchantId 始终取调用方所属主体，**不接受前端指定**；附属商家账号进来直接 403 COUPON_CREATOR_NOT_MAIN。创建后固定为 DRAFT，需显式上架。',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [coupon_template_dto_1.CreateCouponTemplateDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], CouponTemplateController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Permissions)('coupon:edit'),
    (0, swagger_1.ApiOperation)({
        summary: '编辑券模板（仅 DRAFT / UNPUBLISHED）',
        description: '已上架的模板必须先下架才能改（TEMPLATE_NOT_EDITABLE），避免改掉已在用户手上的券口径。',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __param(4, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, coupon_template_dto_1.UpdateCouponTemplateDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], CouponTemplateController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/publish'),
    (0, roles_decorator_1.Permissions)('coupon:publish'),
    (0, swagger_1.ApiOperation)({ summary: '上架券模板（DRAFT / UNPUBLISHED → PUBLISHED）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String, String]),
    __metadata("design:returntype", void 0)
], CouponTemplateController.prototype, "publish", null);
__decorate([
    (0, common_1.Patch)(':id/unpublish'),
    (0, roles_decorator_1.Permissions)('coupon:publish'),
    (0, swagger_1.ApiOperation)({ summary: '下架券模板（PUBLISHED → UNPUBLISHED）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, String, String]),
    __metadata("design:returntype", void 0)
], CouponTemplateController.prototype, "unpublish", null);
exports.CouponTemplateController = CouponTemplateController = __decorate([
    (0, swagger_1.ApiTags)('coupon-templates'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('coupon-templates'),
    __metadata("design:paramtypes", [coupon_template_service_1.CouponTemplateService])
], CouponTemplateController);
//# sourceMappingURL=coupon-template.controller.js.map