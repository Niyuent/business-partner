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
exports.PointRuleController = exports.PointController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const point_dto_1 = require("./dto/point.dto");
const point_service_1 = require("./point.service");
let PointController = class PointController {
    constructor(points) {
        this.points = points;
    }
    earn(dto, user, ip, ua) {
        return this.points.earn(dto, user, ip, ua);
    }
    exchange(dto, user, ip, ua) {
        return this.points.exchange(dto, user, ip, ua);
    }
    exchangeRecords(query, user) {
        return this.points.listExchangeRecords(query, user);
    }
    adjust(dto, user, ip, ua) {
        return this.points.adjust(dto, user, ip, ua);
    }
};
exports.PointController = PointController;
__decorate([
    (0, common_1.Post)('earn'),
    (0, roles_decorator_1.Permissions)('point:earn'),
    (0, swagger_1.ApiOperation)({
        summary: '消费录单送积分（内部接口，S3.4 订单模块复用）',
        description: '流程：归属解析（商家/门店由 JWT 推导）→ 规则（商家级优先，其次平台级）→ 折算积分 → 事务内写 EARN 批次 + 账户乐观锁更新（冲突重试 3 次，超过 409 `CONCURRENT_UPDATE`）→ 审计。' +
            '传 `orderId`/`orderNo` 启用**一单只送一次**幂等（唯一索引 `(relatedOrderId, type)` 兜底，重复 → 409 `ORDER_POINTS_ALREADY_EARNED`）。',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [point_dto_1.EarnPointsDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], PointController.prototype, "earn", null);
__decorate([
    (0, common_1.Post)('exchange'),
    (0, roles_decorator_1.Permissions)('point:exchange'),
    (0, swagger_1.ApiOperation)({
        summary: '积分兑换代金券（FIFO 扣减 + 券码分配 + 券实例，全同事务）',
        description: '9 步顺序：① 幂等键（相同 requestId 返回上次结果，200 + idempotent:true）→ ② 模板（404 / 409 TEMPLATE_NOT_AVAILABLE / STOCK_EXHAUSTED / PER_USER_LIMIT_EXCEEDED）→ ' +
            '③ 可用积分（过期批次不算，409 BALANCE_NOT_ENOUGH）→ ④ FIFO 扣减 + SPEND 流水（指回券实例）→ ⑤ 券码 FOR UPDATE + 条件更新（409 CODE_POOL_EXHAUSTED）→ ' +
            '⑥ 券实例（issuer=主体商家，source=EXCHANGE）→ ⑦ 账户乐观锁扣减（冲突重试 3 次，409 CONCURRENT_UPDATE）→ ⑧ issuedCount 条件更新 → ⑨ 兑换记录 + 审计。任一步失败整事务回滚。',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [point_dto_1.ExchangePointsDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], PointController.prototype, "exchange", null);
__decorate([
    (0, common_1.Get)('exchange-records'),
    (0, roles_decorator_1.Permissions)('point:exchange:view'),
    (0, swagger_1.ApiOperation)({
        summary: '兑换记录（用户视角：userId 传自己；后台可按用户 / 模板 / 时间筛选）',
        description: '返回券码、券状态、有效期与本次消耗的积分，H5「我的兑换」直接用。',
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [point_dto_1.QueryExchangeRecordsDto, Object]),
    __metadata("design:returntype", void 0)
], PointController.prototype, "exchangeRecords", null);
__decorate([
    (0, common_1.Post)('adjust'),
    (0, roles_decorator_1.Permissions)('point:adjust'),
    (0, swagger_1.ApiOperation)({
        summary: '人工调整积分（正增负减，原因必填 ≥5 字符）',
        description: '负向调整走 **FIFO 扣减**（与兑换一致，过期批次不可用，避免「调账把过期积分盘活」）。' +
            '写 ADJUST 流水 + `audit_logs`（谁改的、改前改后、原因）。余额不足 → 409 `BALANCE_NOT_ENOUGH`。',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [point_dto_1.AdjustPointsDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], PointController.prototype, "adjust", null);
exports.PointController = PointController = __decorate([
    (0, swagger_1.ApiTags)('points'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('points'),
    __metadata("design:paramtypes", [point_service_1.PointService])
], PointController);
let PointRuleController = class PointRuleController {
    constructor(points) {
        this.points = points;
    }
    list(user) {
        return this.points.listRules(user);
    }
    update(id, dto, user, ip, ua) {
        return this.points.updateRule(id, dto, user, ip, ua);
    }
};
exports.PointRuleController = PointRuleController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Permissions)('point:rule:view', 'point:view'),
    (0, swagger_1.ApiOperation)({ summary: '积分规则列表（平台看全部，商家看自己 + 平台默认）' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PointRuleController.prototype, "list", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Permissions)('point:rule:edit'),
    (0, swagger_1.ApiOperation)({
        summary: '修改积分规则（写审计 before/after）',
        description: '改平台规则需平台管理员；同一商家只能有一条生效规则（唯一约束 → 409 `POINT_RULE_ALREADY_ACTIVE`）。',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __param(4, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, point_dto_1.UpdatePointRuleDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], PointRuleController.prototype, "update", null);
exports.PointRuleController = PointRuleController = __decorate([
    (0, swagger_1.ApiTags)('point-rules'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('point-rules'),
    __metadata("design:paramtypes", [point_service_1.PointService])
], PointRuleController);
//# sourceMappingURL=point.controller.js.map