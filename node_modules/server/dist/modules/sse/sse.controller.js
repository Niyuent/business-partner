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
exports.SseController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const api_token_guard_1 = require("../auth/api-token.guard");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const sse_service_1 = require("./sse.service");
const public_decorator_1 = require("../../common/decorators/public.decorator");
let SseController = class SseController {
    constructor(sse) {
        this.sse = sse;
    }
    createTicket(user) {
        const { ticket, expiresIn } = this.sse.createTicket({
            userId: user.sub,
            merchantId: user.merchantId,
            storeId: user.storeId,
            userType: user.userType,
            username: user.username,
        });
        return { ticket, expiresIn, connectUrl: `/api/v1/sse/notifications?ticket=${ticket}` };
    }
    notifications(ticket, req, res) {
        const identity = this.sse.consumeTicket(ticket);
        if (!identity) {
            throw biz_exception_1.BizException.forbidden('INVALID_SSE_TICKET', 'ticket 无效、已使用或已过期');
        }
        res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        });
        res.socket?.setNoDelay?.(true);
        res.write('retry: 3000\n\n');
        res.write(`event: connected\ndata: ${JSON.stringify({
            userId: identity.userId,
            merchantId: identity.merchantId,
            at: new Date().toISOString(),
        })}\n\n`);
        this.sse.addClient(res, identity);
        req.on('close', () => this.sse.removeClient(res));
        req.on('error', () => this.sse.removeClient(res));
    }
    publish(body) {
        const sent = this.sse.broadcast(body.event ?? 'message', body.data ?? {}, body.target);
        return { sent, target: body.target ?? 'all' };
    }
    stats() {
        return this.sse.stats();
    }
};
exports.SseController = SseController;
__decorate([
    (0, common_1.Post)('ticket'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: '凭 JWT 换取 SSE 一次性 ticket（60s）' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SseController.prototype, "createTicket", null);
__decorate([
    (0, common_1.Get)('notifications'),
    (0, swagger_1.ApiOperation)({ summary: 'SSE 事件流（?ticket=一次性票据）' }),
    __param(0, (0, common_1.Query)('ticket')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], SseController.prototype, "notifications", null);
__decorate([
    (0, common_1.Post)('publish'),
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(api_token_guard_1.ApiTokenGuard),
    (0, swagger_1.ApiOperation)({ summary: '【外部系统对接】向指定维度推送 SSE 事件' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SseController.prototype, "publish", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(api_token_guard_1.ApiTokenGuard),
    (0, swagger_1.ApiOperation)({ summary: 'SSE 连接统计（API_TOKEN）' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SseController.prototype, "stats", null);
exports.SseController = SseController = __decorate([
    (0, swagger_1.ApiTags)('sse'),
    (0, common_1.Controller)('sse'),
    __metadata("design:paramtypes", [sse_service_1.SseService])
], SseController);
//# sourceMappingURL=sse.controller.js.map