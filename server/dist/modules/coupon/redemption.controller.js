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
exports.RedemptionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const redemption_dto_1 = require("./dto/redemption.dto");
const redemption_service_1 = require("./redemption.service");
let RedemptionController = class RedemptionController {
    constructor(redemptions) {
        this.redemptions = redemptions;
    }
    verify(dto, user) {
        return this.redemptions.verify(dto, user);
    }
    redeem(dto, user, ip, ua) {
        return this.redemptions.redeem(dto, user, ip, ua);
    }
    list(query, user) {
        return this.redemptions.list(query, user);
    }
    reverse(id, dto, user, ip, ua) {
        return this.redemptions.reverse(id, dto, user, ip, ua);
    }
};
exports.RedemptionController = RedemptionController;
__decorate([
    (0, common_1.Post)('verify'),
    (0, roles_decorator_1.Permissions)('redemption:verify', 'redemption:create'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: '核销前置校验（只读，不写库）',
        description: '返回券信息 + redeemable + reasonCode + 逐项 checks。成功 HTTP 200；失败 404 CODE_NOT_FOUND / 403 STORE_NOT_OWNED·STORE_NOT_IN_SCOPE / 409 COUPON_ALREADY_USED·COUPON_FROZEN·COUPON_EXPIRED·TEMPLATE_NOT_AVAILABLE·CODE_NOT_ISSUED·COUPON_NOT_BELONG_TO_USER·THRESHOLD_NOT_MET·ORDER_ALREADY_HAS_COUPON（失败响应 data 里仍带 coupon 与 checks）。',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [redemption_dto_1.VerifyCouponDto, Object]),
    __metadata("design:returntype", void 0)
], RedemptionController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Permissions)('redemption:create'),
    (0, swagger_1.ApiOperation)({
        summary: '执行核销',
        description: '事务内：① 订单绑定（409 ORDER_ALREADY_HAS_COUPON）→ ② 券实例条件更新 UNUSED→USED（409 COUPON_ALREADY_USED / COUPON_FROZEN / COUPON_EXPIRED）→ ③ 券码 REDEEMED + 模板 usedCount+1 → ④ 核销记录（唯一索引兜底）→ ⑤ 审计。',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [redemption_dto_1.CreateRedemptionDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], RedemptionController.prototype, "redeem", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Permissions)('redemption:view'),
    (0, swagger_1.ApiOperation)({
        summary: '核销记录列表（含按商家分组合计）',
        description: '数据隔离：平台全量；主体看自己门店 + 自己模板的核销；附属 / 店员只看本店。附属传别人的 merchantId → 403 FORBIDDEN_SCOPE。',
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [redemption_dto_1.QueryRedemptionsDto, Object]),
    __metadata("design:returntype", void 0)
], RedemptionController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(':id/reverse'),
    (0, roles_decorator_1.Permissions)('redemption:reverse'),
    (0, swagger_1.ApiOperation)({
        summary: '核销冲正（券退回未使用）',
        description: '记录保留为 REVERSED（不是删除），券实例回 UNUSED、券码回 ISSUED、模板 usedCount-1、订单解绑（同一订单随后可改用另一张券）。\n\n**权限收紧（S2.4）**：附属商家 / 店员只能冲正**本店 + 24 小时内**的记录；超时返回 403 `REVERSE_WINDOW_EXPIRED`，跨店返回 403 `STORE_NOT_OWNED`，这两种情况需要主体商家操作。\n\n**reason 必填（≥5 字符）**，同时写入 `redemption_records.reverseReason` 与审计日志。',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __param(4, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, redemption_dto_1.ReverseRedemptionDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], RedemptionController.prototype, "reverse", null);
exports.RedemptionController = RedemptionController = __decorate([
    (0, swagger_1.ApiTags)('redemptions'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('redemptions'),
    __metadata("design:paramtypes", [redemption_service_1.RedemptionService])
], RedemptionController);
//# sourceMappingURL=redemption.controller.js.map