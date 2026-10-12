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
exports.UserController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const user_dto_1 = require("./dto/user.dto");
const user_service_1 = require("./user.service");
let UserController = class UserController {
    constructor(users) {
        this.users = users;
    }
    list(query, user) {
        return this.users.list(query, user);
    }
    detail(id, user) {
        return this.users.detail(id, user);
    }
    updateStatus(id, dto, user, ip, ua) {
        return this.users.updateStatus(id, user, dto, ip, ua);
    }
    bindPhone(id, dto, user, ip, ua) {
        return this.users.bindPhone(id, user, dto, ip, ua);
    }
};
exports.UserController = UserController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Permissions)('user:view'),
    (0, swagger_1.ApiOperation)({ summary: '用户列表（分页 / 手机号 / 昵称 / 状态 / 注册时间筛选）' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_dto_1.QueryUsersDto, Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Permissions)('user:view'),
    (0, swagger_1.ApiOperation)({ summary: '用户详情（基本信息 + 积分余额 + 券 + 消费 + 核销 + 来源商家）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, roles_decorator_1.Permissions)('user:edit'),
    (0, swagger_1.ApiOperation)({ summary: '启用 / 禁用用户' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __param(4, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, user_dto_1.UpdateUserStatusDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Post)(':id/bind-phone'),
    (0, roles_decorator_1.Permissions)('user:edit'),
    (0, swagger_1.ApiOperation)({ summary: '绑定 / 修改用户手机号（手机号全局唯一）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __param(4, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, user_dto_1.BindPhoneDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "bindPhone", null);
exports.UserController = UserController = __decorate([
    (0, swagger_1.ApiTags)('users'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [user_service_1.UserService])
], UserController);
//# sourceMappingURL=user.controller.js.map