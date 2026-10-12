"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const auth_controller_1 = require("./auth.controller");
const api_token_guard_1 = require("./api-token.guard");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
const auth_service_1 = require("./auth.service");
const user_jwt_auth_guard_1 = require("./user-jwt-auth.guard");
const wx_service_1 = require("./wx.service");
const rate_limit_service_1 = require("../../common/services/rate-limit.service");
const roles_guard_1 = require("../../common/guards/roles.guard");
const merchant_scope_guard_1 = require("../../common/guards/merchant-scope.guard");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            jwt_1.JwtModule.registerAsync({
                useFactory: () => ({
                    secret: process.env.JWT_SECRET || 'shangmeng-dev-secret',
                    signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '2h' },
                }),
            }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [auth_service_1.AuthService, jwt_auth_guard_1.JwtAuthGuard, user_jwt_auth_guard_1.UserJwtAuthGuard, wx_service_1.WxService, rate_limit_service_1.RateLimitService, api_token_guard_1.ApiTokenGuard, roles_guard_1.RolesGuard, merchant_scope_guard_1.MerchantScopeGuard],
        exports: [jwt_1.JwtModule, auth_service_1.AuthService, jwt_auth_guard_1.JwtAuthGuard, user_jwt_auth_guard_1.UserJwtAuthGuard, wx_service_1.WxService, api_token_guard_1.ApiTokenGuard, roles_guard_1.RolesGuard, merchant_scope_guard_1.MerchantScopeGuard],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map