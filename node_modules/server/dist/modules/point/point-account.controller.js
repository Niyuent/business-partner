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
exports.PointAccountController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const point_dto_1 = require("./dto/point.dto");
const point_service_1 = require("./point.service");
let PointAccountController = class PointAccountController {
    constructor(points) {
        this.points = points;
    }
    list(query, user) {
        return this.points.listAccounts(query, user);
    }
    detail(userId, user) {
        return this.points.accountDetail(userId, user);
    }
};
exports.PointAccountController = PointAccountController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Permissions)('point:view'),
    (0, swagger_1.ApiOperation)({
        summary: '积分账户列表（用户昵称 / 手机号 / 余额筛选，含临期积分）',
        description: '列表带 `expiringSoon` 字段（30 天内过期的可用积分），便于运营筛选「该提醒的用户」。',
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [point_dto_1.QueryPointAccountsDto, Object]),
    __metadata("design:returntype", void 0)
], PointAccountController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':userId'),
    (0, roles_decorator_1.Permissions)('point:view'),
    (0, swagger_1.ApiOperation)({
        summary: '积分账户详情（余额 + 批次明细 + 临期汇总）',
        description: '`summary.available` 是**真正能花的**（未过期批次剩余之和），与 `balance` 的差额即「已过期待清理」的批次——S3.2「余额够但兑换失败」的原因就在这里。',
    }),
    __param(0, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], PointAccountController.prototype, "detail", null);
exports.PointAccountController = PointAccountController = __decorate([
    (0, swagger_1.ApiTags)('point-accounts'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('point-accounts'),
    __metadata("design:paramtypes", [point_service_1.PointService])
], PointAccountController);
//# sourceMappingURL=point-account.controller.js.map