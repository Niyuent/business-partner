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
exports.FreezeInstanceDto = exports.QueryInstancesDto = exports.IssueCouponDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const coupon_template_dto_1 = require("./coupon-template.dto");
class IssueCouponDto {
}
exports.IssueCouponDto = IssueCouponDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '券模板 id', example: 1001 }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], IssueCouponDto.prototype, "templateId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'C 端用户 id；与 phone 二选一', example: 1001 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], IssueCouponDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'C 端手机号；与 userId 二选一', example: '13800138001' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(6, 20),
    __metadata("design:type", String)
], IssueCouponDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '发放数量，默认 1，单次最多 50', example: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(50),
    __metadata("design:type", Number)
], IssueCouponDto.prototype, "quantity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '以哪个商家的身份发放；**仅平台管理员可用**，其余账号传了会被忽略（仍按 JWT）',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], IssueCouponDto.prototype, "merchantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '发放备注（写进审计 after）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], IssueCouponDto.prototype, "remark", void 0);
class QueryInstancesDto extends coupon_template_dto_1.PageQueryDto {
}
exports.QueryInstancesDto = QueryInstancesDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按券模板筛选' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryInstancesDto.prototype, "templateId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按 C 端用户筛选' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryInstancesDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['UNUSED', 'USED', 'EXPIRED', 'FROZEN'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['UNUSED', 'USED', 'EXPIRED', 'FROZEN']),
    __metadata("design:type", String)
], QueryInstancesDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按发放商家筛选；附属商家只能传自己，传别人 403' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryInstancesDto.prototype, "issuerMerchantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '券码精确/模糊查询' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 32),
    __metadata("design:type", String)
], QueryInstancesDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '有效期起点（含）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], QueryInstancesDto.prototype, "expireFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '有效期终点（含）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], QueryInstancesDto.prototype, "expireTo", void 0);
class FreezeInstanceDto {
}
exports.FreezeInstanceDto = FreezeInstanceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'true=冻结，false=解冻', example: true }),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FreezeInstanceDto.prototype, "frozen", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '冻结原因（写进审计）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], FreezeInstanceDto.prototype, "reason", void 0);
//# sourceMappingURL=coupon-instance.dto.js.map