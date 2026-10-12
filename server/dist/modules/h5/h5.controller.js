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
exports.H5Controller = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const user_jwt_auth_guard_1 = require("../auth/user-jwt-auth.guard");
const point_dto_1 = require("../point/dto/point.dto");
const h5_service_1 = require("./h5.service");
let H5Controller = class H5Controller {
    constructor(h5) {
        this.h5 = h5;
    }
    me(user) {
        return this.h5.me(user);
    }
    account(user) {
        return this.h5.account(user);
    }
    transactions(user, query) {
        return this.h5.transactions(user, query);
    }
    templates() {
        return this.h5.templates();
    }
    exchangeRecords(user, query) {
        return this.h5.exchangeRecords(user, query);
    }
    exchange(user, dto) {
        return this.h5.exchange(user, dto);
    }
};
exports.H5Controller = H5Controller;
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: '当前 C 端用户资料' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], H5Controller.prototype, "me", null);
__decorate([
    (0, common_1.Get)('points/account'),
    (0, swagger_1.ApiOperation)({ summary: '我的积分账户（余额 / 批次 / 可用与临期）' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], H5Controller.prototype, "account", null);
__decorate([
    (0, common_1.Get)('points/transactions'),
    (0, swagger_1.ApiOperation)({ summary: '我的积分流水' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, point_dto_1.QueryPointTransactionsDto]),
    __metadata("design:returntype", void 0)
], H5Controller.prototype, "transactions", null);
__decorate([
    (0, common_1.Get)('templates'),
    (0, swagger_1.ApiOperation)({ summary: '可兑换券列表（已上架 + 有库存 + 设了兑换积分）' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], H5Controller.prototype, "templates", null);
__decorate([
    (0, common_1.Get)('exchange-records'),
    (0, swagger_1.ApiOperation)({ summary: '我的兑换记录' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, point_dto_1.QueryExchangeRecordsDto]),
    __metadata("design:returntype", void 0)
], H5Controller.prototype, "exchangeRecords", null);
__decorate([
    (0, common_1.Post)('exchange'),
    (0, swagger_1.ApiOperation)({ summary: '积分兑换代金券（userId 取自令牌；伪造 userId → 403）' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, point_dto_1.ExchangePointsDto]),
    __metadata("design:returntype", void 0)
], H5Controller.prototype, "exchange", null);
exports.H5Controller = H5Controller = __decorate([
    (0, swagger_1.ApiTags)('h5'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('h5'),
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(user_jwt_auth_guard_1.UserJwtAuthGuard),
    __metadata("design:paramtypes", [h5_service_1.H5Service])
], H5Controller);
//# sourceMappingURL=h5.controller.js.map