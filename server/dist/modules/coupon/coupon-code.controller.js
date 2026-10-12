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
exports.CouponCodeController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const coupon_code_service_1 = require("./coupon-code.service");
const coupon_code_dto_1 = require("./dto/coupon-code.dto");
let CouponCodeController = class CouponCodeController {
    constructor(codes) {
        this.codes = codes;
    }
    generate(id, dto, user, ip, ua) {
        return this.codes.generate(id, dto, user, ip, ua);
    }
    list(id, query, user) {
        return this.codes.list(id, query, user);
    }
    batches(id, user) {
        return this.codes.batches(id, user);
    }
};
exports.CouponCodeController = CouponCodeController;
__decorate([
    (0, common_1.Post)(':id/codes'),
    (0, roles_decorator_1.Permissions)('coupon:code:generate'),
    (0, swagger_1.ApiOperation)({
        summary: '预生成券码（批次号 + 数量）',
        description: '券码为 12 位（11 位 crypto 随机位 + 1 位校验位），字符集去掉 0/O/1/I/L；batchNo 不传自动生成 `{templateId}-{yyyymmdd}-{seq}`，重复批次 409 BATCH_ALREADY_EXISTS。',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __param(4, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, coupon_code_dto_1.GenerateCodesDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], CouponCodeController.prototype, "generate", null);
__decorate([
    (0, common_1.Get)(':id/codes'),
    (0, roles_decorator_1.Permissions)('coupon:view'),
    (0, swagger_1.ApiOperation)({
        summary: '券码列表（分页 + 状态/批次筛选）',
        description: '越权访问（看不到该模板）一律 404，不返回任何券码明文。',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, coupon_code_dto_1.QueryCodesDto, Object]),
    __metadata("design:returntype", void 0)
], CouponCodeController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id/batches'),
    (0, roles_decorator_1.Permissions)('coupon:view'),
    (0, swagger_1.ApiOperation)({ summary: '券码批次列表（含每批实际生成数量）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CouponCodeController.prototype, "batches", null);
exports.CouponCodeController = CouponCodeController = __decorate([
    (0, swagger_1.ApiTags)('coupon-codes'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('coupon-templates'),
    __metadata("design:paramtypes", [coupon_code_service_1.CouponCodeService])
], CouponCodeController);
//# sourceMappingURL=coupon-code.controller.js.map