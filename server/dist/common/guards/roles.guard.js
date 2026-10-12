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
exports.RolesGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const biz_exception_1 = require("../exceptions/biz.exception");
const roles_decorator_1 = require("../decorators/roles.decorator");
let RolesGuard = class RolesGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const requiredRoles = this.reflector.getAllAndOverride(roles_decorator_1.ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const requiredPerms = this.reflector.getAllAndOverride(roles_decorator_1.PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
        if (!requiredRoles?.length && !requiredPerms?.length) {
            return true;
        }
        const req = context.switchToHttp().getRequest();
        const user = req.user;
        if (!user) {
            throw new common_1.UnauthorizedException('缺少登录身份');
        }
        if (requiredRoles?.length) {
            const owned = new Set(user.roles ?? []);
            if (!requiredRoles.some((code) => owned.has(code))) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.ROLE_NOT_ALLOWED, `需要角色：${requiredRoles.join(' / ')}`);
            }
        }
        if (requiredPerms?.length) {
            const owned = new Set(user.permissions ?? []);
            if (!requiredPerms.some((code) => owned.has(code))) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.PERMISSION_DENIED, `缺少权限码：${requiredPerms.join(' / ')}`);
            }
        }
        return true;
    }
};
exports.RolesGuard = RolesGuard;
exports.RolesGuard = RolesGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], RolesGuard);
//# sourceMappingURL=roles.guard.js.map