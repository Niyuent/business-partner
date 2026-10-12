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
exports.UnauthorizedException = exports.MerchantScopeGuard = void 0;
exports.scopedWhere = scopedWhere;
const common_1 = require("@nestjs/common");
Object.defineProperty(exports, "UnauthorizedException", { enumerable: true, get: function () { return common_1.UnauthorizedException; } });
const constants_1 = require("@nestjs/common/constants");
const core_1 = require("@nestjs/core");
const biz_exception_1 = require("../exceptions/biz.exception");
const public_decorator_1 = require("../decorators/public.decorator");
let MerchantScopeGuard = class MerchantScopeGuard {
    constructor(reflector) {
        this.reflector = reflector;
        this.logger = new common_1.Logger('MerchantScope');
    }
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        if (!this.isSubRoute(context, req)) {
            return true;
        }
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        const user = req.user;
        if (!user) {
            this.logger.debug(`/sub 路由尚未解析出身份，交给 JwtAuthGuard：${req.originalUrl ?? req.url}`);
            return true;
        }
        const requestedMerchantId = pickNumeric(req, 'merchantId');
        const requestedStoreId = pickNumeric(req, 'storeId');
        const isPlatform = user.userType === 'PLATFORM';
        const ownMerchantId = user.merchantId ?? null;
        if (!isPlatform && requestedMerchantId !== undefined && requestedMerchantId !== ownMerchantId) {
            this.logger.warn(`越权拦截 user=${user.sub}(${user.username}) 请求 merchantId=${requestedMerchantId}，实际归属=${ownMerchantId}`);
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '无权访问该商家的数据');
        }
        const ownStoreId = user.storeId ?? null;
        if (user.userType === 'STORE' && requestedStoreId !== undefined && requestedStoreId !== ownStoreId) {
            this.logger.warn(`越权拦截 user=${user.sub}(${user.username}) 请求 storeId=${requestedStoreId}，实际归属=${ownStoreId}`);
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, '无权访问该门店的数据');
        }
        const effectiveMerchantId = isPlatform ? (requestedMerchantId ?? null) : ownMerchantId;
        const effectiveStoreId = user.userType === 'STORE' ? ownStoreId : (requestedStoreId ?? null);
        if (!isPlatform && effectiveMerchantId === null) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.SCOPE_NOT_READY, '无法确定数据归属范围，拒绝执行查询');
        }
        if (!isPlatform && effectiveMerchantId !== null) {
            assignNumeric(req, 'merchantId', effectiveMerchantId);
        }
        if (requestedStoreId !== undefined || user.userType === 'STORE') {
            if (effectiveStoreId !== null) {
                assignNumeric(req, 'storeId', effectiveStoreId);
            }
        }
        req.scope = {
            merchantId: effectiveMerchantId,
            storeId: effectiveStoreId,
            userType: user.userType,
            userId: user.sub,
            isPlatform,
        };
        return true;
    }
    isSubRoute(context, req) {
        const controllerPath = this.reflector.get(constants_1.PATH_METADATA, context.getClass()) ?? '';
        if (controllerPath) {
            return controllerPath === 'sub' || controllerPath.startsWith('sub/');
        }
        const url = (req.originalUrl ?? req.url ?? '').split('?')[0];
        return url.split('/').includes('sub');
    }
};
exports.MerchantScopeGuard = MerchantScopeGuard;
exports.MerchantScopeGuard = MerchantScopeGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], MerchantScopeGuard);
function pickNumeric(req, key) {
    const raw = req.query?.[key] ??
        req.body?.[key] ??
        req.params?.[key];
    if (raw === undefined || raw === null || raw === '')
        return undefined;
    const num = Number(raw);
    return Number.isFinite(num) ? num : undefined;
}
function assignNumeric(req, key, value) {
    if (req.query)
        req.query[key] = String(value);
    if (req.body && typeof req.body === 'object') {
        req.body[key] = value;
    }
}
function scopedWhere(scope) {
    if (scope.isPlatform && scope.merchantId === null)
        return {};
    const where = {};
    if (scope.merchantId !== null)
        where.merchantId = scope.merchantId;
    if (scope.storeId !== null)
        where.storeId = scope.storeId;
    return where;
}
//# sourceMappingURL=merchant-scope.guard.js.map