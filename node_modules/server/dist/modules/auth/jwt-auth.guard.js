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
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const jwt_1 = require("@nestjs/jwt");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const allow_password_change_decorator_1 = require("../../common/decorators/allow-password-change.decorator");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let JwtAuthGuard = class JwtAuthGuard {
    constructor(jwt, reflector, prisma) {
        this.jwt = jwt;
        this.reflector = reflector;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        const req = context.switchToHttp().getRequest();
        const header = req.headers?.authorization || '';
        const token = header.startsWith('Bearer ')
            ? header.slice(7)
            : (req.query?.token ?? '');
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
        if (payload.kind === 'USER') {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, 'C 端令牌不能访问后台接口');
        }
        const account = await this.prisma.adminUser.findUnique({
            where: { id: payload.sub },
            select: {
                status: true,
                mustChangePassword: true,
                merchant: { select: { status: true } },
            },
        });
        if (!account) {
            throw biz_exception_1.BizException.unauthorized(biz_exception_1.ReasonCode.INVALID_CREDENTIALS, '账号不存在或已被删除');
        }
        if (account.status !== 'ACTIVE') {
            throw biz_exception_1.BizException.unauthorized(biz_exception_1.ReasonCode.ACCOUNT_DISABLED, '账号已停用');
        }
        if (account.merchant && account.merchant.status !== 'APPROVED') {
            throw biz_exception_1.BizException.unauthorized(biz_exception_1.ReasonCode.MERCHANT_SUSPENDED, `所属商家状态为 ${account.merchant.status}，暂不可登录`);
        }
        if (account.mustChangePassword) {
            const allowed = this.reflector.getAllAndOverride(allow_password_change_decorator_1.ALLOW_PASSWORD_CHANGE_REQUIRED_KEY, [context.getHandler(), context.getClass()]);
            if (!allowed) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.PASSWORD_CHANGE_REQUIRED, '首次登录请先修改密码（PUT /api/v1/auth/password）');
            }
        }
        req.user = payload;
        return true;
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        core_1.Reflector,
        prisma_service_1.PrismaService])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map