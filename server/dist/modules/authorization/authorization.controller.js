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
exports.AuthorizationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const authorization_service_1 = require("./authorization.service");
const authorization_dto_1 = require("./dto/authorization.dto");
let AuthorizationController = class AuthorizationController {
    constructor(authorizations) {
        this.authorizations = authorizations;
    }
    availableTemplates(user) {
        return this.authorizations.availableTemplates(user);
    }
    logs(query, user) {
        return this.authorizations.logs(query, user);
    }
    list(query, user) {
        return this.authorizations.list(query, user);
    }
    create(dto, user, ip, ua) {
        return this.authorizations.create(dto, user, ip, ua);
    }
    disable(id, dto, user, ip, ua) {
        return this.authorizations.disable(id, dto, user, ip, ua);
    }
};
exports.AuthorizationController = AuthorizationController;
__decorate([
    (0, common_1.Get)('available-templates'),
    (0, roles_decorator_1.Permissions)('authorization:view'),
    (0, swagger_1.ApiOperation)({ summary: '可选主体券模板（本主体拥有、已上架、MAIN_COUPON）' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthorizationController.prototype, "availableTemplates", null);
__decorate([
    (0, common_1.Get)('logs'),
    (0, roles_decorator_1.Permissions)('authorization:view'),
    (0, swagger_1.ApiOperation)({
        summary: '授权记录（报表用）：谁开的、谁关的、时间、原因',
        description: '读 audit_logs（module=authorization），已按主体做数据隔离。',
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [authorization_dto_1.QueryAuthorizationLogsDto, Object]),
    __metadata("design:returntype", void 0)
], AuthorizationController.prototype, "logs", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Permissions)('authorization:view'),
    (0, swagger_1.ApiOperation)({ summary: '授权列表（主体视角，含模板清单）' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [authorization_dto_1.QueryAuthorizationsDto, Object]),
    __metadata("design:returntype", void 0)
], AuthorizationController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Permissions)('authorization:manage'),
    (0, swagger_1.ApiOperation)({
        summary: '开启授权',
        description: '已授权 → 409 AUTHORIZATION_EXISTS；曾关闭过 → 重新启用同一条记录（reactivated=true）。',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [authorization_dto_1.CreateAuthorizationDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], AuthorizationController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id/disable'),
    (0, roles_decorator_1.Permissions)('authorization:manage'),
    (0, swagger_1.ApiOperation)({
        summary: '关闭授权（幂等）',
        description: '重复关闭返回 200 + alreadyDisabled:true，不报 409/500。revokeReason 写入 revoke_reason 用于追溯。',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __param(4, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, authorization_dto_1.DisableAuthorizationDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], AuthorizationController.prototype, "disable", null);
exports.AuthorizationController = AuthorizationController = __decorate([
    (0, swagger_1.ApiTags)('authorizations'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('authorizations'),
    __metadata("design:paramtypes", [authorization_service_1.AuthorizationService])
], AuthorizationController);
//# sourceMappingURL=authorization.controller.js.map