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
exports.MerchantController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const rate_limit_service_1 = require("../../common/services/rate-limit.service");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const merchant_service_1 = require("./merchant.service");
const application_dto_1 = require("./dto/application.dto");
const merchant_dto_1 = require("./dto/merchant.dto");
let MerchantController = class MerchantController {
    constructor(merchants, rateLimit) {
        this.merchants = merchants;
        this.rateLimit = rateLimit;
    }
    createApplication(dto, ip, ua) {
        this.rateLimit.check(`merchant-application:${ip ?? 'unknown'}`, 3, 60 * 60 * 1000);
        return this.merchants.createApplication(dto, ip, ua);
    }
    listApplications(query, user) {
        return this.merchants.listApplications(query, user);
    }
    approve(id, dto, user, ip, ua) {
        return this.merchants.approve(id, dto, user, ip, ua);
    }
    reject(id, dto, user, ip, ua) {
        return this.merchants.reject(id, dto, user, ip, ua);
    }
    list(query, user) {
        return this.merchants.list(query, user);
    }
    detail(id, user) {
        return this.merchants.detail(id, user);
    }
    updateStatus(id, dto, user, ip, ua, _req) {
        return this.merchants.updateStatus(id, dto, user, ip, ua);
    }
};
exports.MerchantController = MerchantController;
__decorate([
    (0, common_1.Post)('applications'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({
        summary: '提交入驻申请（公开，无需登录）',
        description: '这是一个无需登录即可写库的端点，同 IP 每小时最多 3 次，超限返回 429 RATE_LIMITED。',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Ip)()),
    __param(2, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [application_dto_1.CreateApplicationDto, String, String]),
    __metadata("design:returntype", void 0)
], MerchantController.prototype, "createApplication", null);
__decorate([
    (0, common_1.Get)('applications'),
    (0, roles_decorator_1.Permissions)('merchant:view'),
    (0, swagger_1.ApiOperation)({ summary: '入驻申请列表（默认待审核）' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [application_dto_1.QueryApplicationsDto, Object]),
    __metadata("design:returntype", void 0)
], MerchantController.prototype, "listApplications", null);
__decorate([
    (0, common_1.Post)('applications/:id/approve'),
    (0, roles_decorator_1.Permissions)('merchant:audit'),
    (0, swagger_1.ApiOperation)({
        summary: '审核通过（自动创建管理员账号并一次性返回初始口令）',
        description: '重复审核返回 409 MERCHANT_NOT_PENDING；账号口令为随机 12 位，仅在本次响应中出现。',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __param(4, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, application_dto_1.ApproveApplicationDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], MerchantController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)('applications/:id/reject'),
    (0, roles_decorator_1.Permissions)('merchant:audit'),
    (0, swagger_1.ApiOperation)({ summary: '驳回申请（auditRemark 必填）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __param(4, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, application_dto_1.RejectApplicationDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], MerchantController.prototype, "reject", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Permissions)('merchant:view'),
    (0, swagger_1.ApiOperation)({ summary: '商家列表（平台看全部，主体看自己+直属附属）' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [merchant_dto_1.QueryMerchantsDto, Object]),
    __metadata("design:returntype", void 0)
], MerchantController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Permissions)('merchant:view'),
    (0, swagger_1.ApiOperation)({ summary: '商家详情（含门店、账号、父级）' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], MerchantController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, roles_decorator_1.Permissions)('merchant:manage'),
    (0, swagger_1.ApiOperation)({
        summary: '启用 / 暂停商家',
        description: 'APPROVED ↔ SUSPENDED；写 audit_logs（操作人 + 时间）。停用后其账号登录会被拒绝。',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Ip)()),
    __param(4, (0, common_1.Headers)('user-agent')),
    __param(5, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, merchant_dto_1.UpdateMerchantStatusDto, Object, String, String, Object]),
    __metadata("design:returntype", void 0)
], MerchantController.prototype, "updateStatus", null);
exports.MerchantController = MerchantController = __decorate([
    (0, swagger_1.ApiTags)('merchant'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('merchants'),
    __metadata("design:paramtypes", [merchant_service_1.MerchantService,
        rate_limit_service_1.RateLimitService])
], MerchantController);
//# sourceMappingURL=merchant.controller.js.map