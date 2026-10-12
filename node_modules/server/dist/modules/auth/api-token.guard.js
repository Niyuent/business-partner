"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiTokenGuard = void 0;
const common_1 = require("@nestjs/common");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
let ApiTokenGuard = class ApiTokenGuard {
    canActivate(context) {
        const expected = process.env.API_TOKEN;
        if (!expected) {
            throw biz_exception_1.BizException.forbidden('API_TOKEN_NOT_CONFIGURED', '服务端未配置 API_TOKEN');
        }
        const req = context.switchToHttp().getRequest();
        const provided = req.headers?.['x-api-token'] ||
            req.query?.token ||
            req.body?.token;
        if (provided !== expected) {
            throw biz_exception_1.BizException.forbidden('INVALID_API_TOKEN', '无效的 API_TOKEN');
        }
        return true;
    }
};
exports.ApiTokenGuard = ApiTokenGuard;
exports.ApiTokenGuard = ApiTokenGuard = __decorate([
    (0, common_1.Injectable)()
], ApiTokenGuard);
//# sourceMappingURL=api-token.guard.js.map