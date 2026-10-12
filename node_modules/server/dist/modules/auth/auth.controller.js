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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const allow_password_change_decorator_1 = require("../../common/decorators/allow-password-change.decorator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const rate_limit_service_1 = require("../../common/services/rate-limit.service");
const current_user_decorator_1 = require("./current-user.decorator");
const auth_service_1 = require("./auth.service");
const login_dto_1 = require("./dto/login.dto");
const update_password_dto_1 = require("./dto/update-password.dto");
const user_login_dto_1 = require("./dto/user-login.dto");
let AuthController = class AuthController {
    constructor(auth, rateLimit) {
        this.auth = auth;
        this.rateLimit = rateLimit;
    }
    login(dto, ip) {
        return this.auth.login(dto.username, dto.password, ip);
    }
    userLogin(dto, ip) {
        this.rateLimit.check(`user-login:${ip ?? 'unknown'}`, 20, 60 * 1000);
        return this.auth.userLogin(dto.code, ip);
    }
    profile(user) {
        return this.auth.profile(user.sub);
    }
    permissions(user) {
        return this.auth.permissions(user.sub);
    }
    updatePassword(user, dto) {
        return this.auth.updatePassword(user.sub, dto);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: '账号密码登录，返回 token + 角色 + 权限码 + 商家上下文' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('user-login'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'C 端登录（微信 code2session → 签发 C 端 JWT，仅可访问 /h5/**）' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_login_dto_1.UserLoginDto, String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "userLogin", null);
__decorate([
    (0, common_1.Get)('profile'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '当前登录账号信息（含商家、门店、角色、权限码）' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "profile", null);
__decorate([
    (0, common_1.Get)('permissions'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: '当前账号的角色码与权限码列表' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "permissions", null);
__decorate([
    (0, common_1.Put)('password'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, allow_password_change_decorator_1.AllowPasswordChangeRequired)(),
    (0, swagger_1.ApiOperation)({
        summary: '修改当前账号密码（需校验原密码）',
        description: '这是 must_change_password=true 的账号唯一能调用的接口，改密成功后自动解除限制。',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_password_dto_1.UpdatePasswordDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "updatePassword", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        rate_limit_service_1.RateLimitService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map