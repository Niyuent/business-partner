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
exports.QueryMeAuthorizationsDto = exports.QueryAuthorizationLogsDto = exports.QueryAuthorizationsDto = exports.DisableAuthorizationDto = exports.CreateAuthorizationDto = exports.PageQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class PageQueryDto {
    constructor() {
        this.page = 1;
        this.pageSize = 20;
    }
}
exports.PageQueryDto = PageQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PageQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 20 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], PageQueryDto.prototype, "pageSize", void 0);
class CreateAuthorizationDto {
    constructor() {
        this.authType = 'ISSUE_MAIN_COUPON';
    }
}
exports.CreateAuthorizationDto = CreateAuthorizationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '主体商家 id；**仅平台管理员可指定**，主体管理员传别人的值会被拒绝',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreateAuthorizationDto.prototype, "mainMerchantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '被授权的附属商家 id（必须是该主体的直接下属且已通过审核）' }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreateAuthorizationDto.prototype, "subMerchantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['ISSUE_MAIN_COUPON'], default: 'ISSUE_MAIN_COUPON' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['ISSUE_MAIN_COUPON']),
    __metadata("design:type", String)
], CreateAuthorizationDto.prototype, "authType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['ALL', 'SPECIFIED'],
        description: 'ALL=全部主体券；SPECIFIED=仅限 templates[] 内的模板',
    }),
    (0, class_validator_1.IsIn)(['ALL', 'SPECIFIED']),
    __metadata("design:type", String)
], CreateAuthorizationDto.prototype, "templateScope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'templateScope=SPECIFIED 时必填且不可为空；ALL 时忽略',
        example: [1, 2],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ each: true }),
    (0, class_validator_1.IsPositive)({ each: true }),
    __metadata("design:type", Array)
], CreateAuthorizationDto.prototype, "templateIds", void 0);
class DisableAuthorizationDto {
}
exports.DisableAuthorizationDto = DisableAuthorizationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '关闭原因（写入 revoke_reason，报表可追溯）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 255),
    __metadata("design:type", String)
], DisableAuthorizationDto.prototype, "revokeReason", void 0);
class QueryAuthorizationsDto extends PageQueryDto {
}
exports.QueryAuthorizationsDto = QueryAuthorizationsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按被授权商家筛选' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryAuthorizationsDto.prototype, "subMerchantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['ENABLED', 'DISABLED'], description: '按授权状态筛选' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['ENABLED', 'DISABLED']),
    __metadata("design:type", String)
], QueryAuthorizationsDto.prototype, "status", void 0);
class QueryAuthorizationLogsDto extends PageQueryDto {
}
exports.QueryAuthorizationLogsDto = QueryAuthorizationLogsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '仅平台管理员可指定其它主体' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryAuthorizationLogsDto.prototype, "mainMerchantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '只看该附属商家的授权记录' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryAuthorizationLogsDto.prototype, "subMerchantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['authorization:grant', 'authorization:revoke'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['authorization:grant', 'authorization:revoke']),
    __metadata("design:type", String)
], QueryAuthorizationLogsDto.prototype, "action", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '起始时间（ISO8601）', example: '2026-10-01T00:00:00+08:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], QueryAuthorizationLogsDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '截止时间（ISO8601）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], QueryAuthorizationLogsDto.prototype, "to", void 0);
class QueryMeAuthorizationsDto {
}
exports.QueryMeAuthorizationsDto = QueryMeAuthorizationsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '只能是自己的 merchantId，否则 403' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryMeAuthorizationsDto.prototype, "merchantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '只能是自己的 merchantId，否则 403' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryMeAuthorizationsDto.prototype, "subMerchantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '只能是自己的上级主体，否则 403' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryMeAuthorizationsDto.prototype, "mainMerchantId", void 0);
//# sourceMappingURL=authorization.dto.js.map