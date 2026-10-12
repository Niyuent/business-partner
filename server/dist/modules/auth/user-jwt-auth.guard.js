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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserJwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
let UserJwtAuthGuard = class UserJwtAuthGuard {
    constructor(jwt) {
        this.jwt = jwt;
    }
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const header = req.headers?.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : '';
        if (!token) {
            throw biz_exception_1.BizException.unauthorized(biz_exception_1.ReasonCode.INVALID_CREDENTIALS, '缺少访问令牌');
        }
        let payload;
        try {
            payload = this.jwt.verify(token);
        }
        catch {
            throw biz_exception_1.BizException.unauthorized(biz_exception_1.ReasonCode.INVALID_CREDENTIALS, '令牌无效或已过期');
        }
        if (payload.kind !== 'USER') {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '后台令牌不能访问 C 端接口');
        }
        req.user = payload;
        return true;
    }
};
exports.UserJwtAuthGuard = UserJwtAuthGuard;
exports.UserJwtAuthGuard = UserJwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], UserJwtAuthGuard);
//# sourceMappingURL=user-jwt-auth.guard.js.map