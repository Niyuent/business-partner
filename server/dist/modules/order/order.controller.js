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
exports.OrderController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const order_dto_1 = require("./dto/order.dto");
const order_service_1 = require("./order.service");
let OrderController = class OrderController {
    constructor(orders) {
        this.orders = orders;
    }
    list(query, user) {
        return this.orders.list(query, user);
    }
    listAbnormal(query, user) {
        return this.orders.listAbnormal(query, user);
    }
    detail(id, user) {
        return this.orders.detail(id, user);
    }
    create(dto, user, ip, ua) {
        return this.orders.create(dto, user, ip, ua);
    }
    markAbnormal(id, dto, user, ip, ua) {
        return this.orders.markAbnormal(id, dto, user, ip, ua);
    }
    handle(id, dto, user, ip, ua) {
        return this.orders.handle(id, dto, user, ip, ua);
    }
};
exports.OrderController = OrderController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Permissions)('order:view'),
    (0, swagger_1.ApiOperation)({ summary: '订单列表（主体全平台 / 附属本店 / 店员本店）' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [order_dto_1.QueryOrdersDto, Object]),
    __metadata("design:returntype", void 0)
], OrderController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('abnormal'),
    (0, roles_decorator_1.Permissions)('order:view'),
    (0, swagger_1.ApiOperation)({ summary: '异常订单列表（status=ABNORMAL）' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [order_dto_1.QueryOrdersDto, Object]),
    __metadata("design:returntype", void 0)
], OrderController.prototype, "listAbnormal", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Permissions)('order:view'),
    (0, swagger_1.ApiOperation)({ summary: '订单详情（含券、积分流水、核销记录）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], OrderController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Permissions)('order:handle'),
    (0, swagger_1.ApiOperation)({ summary: '后台补录订单（走 /points/earn 送积分，一单只送一次）' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [order_dto_1.CreateOrderDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], OrderController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id/abnormal'),
    (0, roles_decorator_1.Permissions)('order:mark-abnormal'),
    (0, swagger_1.ApiOperation)({ summary: '标记异常（NORMAL → ABNORMAL，附属也可标记本店订单）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __param(4, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, order_dto_1.MarkAbnormalDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], OrderController.prototype, "markAbnormal", null);
__decorate([
    (0, common_1.Post)(':id/handle'),
    (0, roles_decorator_1.Permissions)('order:handle'),
    (0, swagger_1.ApiOperation)({
        summary: '异常订单处理（CANCEL / AMOUNT_ERROR / DISPUTE）',
        description: '三种处理都单事务：CANCEL→券回 UNUSED+积分回原批次+订单 couponInstanceId 清空；' +
            'AMOUNT_ERROR→ADJUST 负流水冲正；DISPUTE→冲正核销+券回 UNUSED+积分回退。并发处理只有 1 个成功 → 409 ORDER_ALREADY_HANDLED。',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __param(4, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, order_dto_1.HandleOrderDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], OrderController.prototype, "handle", null);
exports.OrderController = OrderController = __decorate([
    (0, swagger_1.ApiTags)('orders'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('orders'),
    __metadata("design:paramtypes", [order_service_1.OrderService])
], OrderController);
//# sourceMappingURL=order.controller.js.map