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
exports.ReverseRedemptionDto = exports.QueryRedemptionsDto = exports.CreateRedemptionDto = exports.VerifyCouponDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const coupon_template_dto_1 = require("./coupon-template.dto");
class VerifyCouponDto {
}
exports.VerifyCouponDto = VerifyCouponDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '券码（12 位）', example: 'ASD5R3U3RWTM' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(12, 32),
    __metadata("design:type", String)
], VerifyCouponDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '核销门店 id；店员可省略（默认 JWT 门店）', example: 101 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], VerifyCouponDto.prototype, "storeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'C 端用户 id（H5 场景校验券归属）', example: 1001 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], VerifyCouponDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '订单号（校验「一单一券」）', example: 'ORD20260101002' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(4, 32),
    __metadata("design:type", String)
], VerifyCouponDto.prototype, "orderNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '订单金额（校验满减门槛）', example: 128 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], VerifyCouponDto.prototype, "orderAmount", void 0);
class CreateRedemptionDto extends VerifyCouponDto {
}
exports.CreateRedemptionDto = CreateRedemptionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '订单号（核销必须挂订单；不存在则按此单号创建消费订单）', example: 'ORD-S23-001' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(4, 32),
    __metadata("design:type", String)
], CreateRedemptionDto.prototype, "orderNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '核销渠道', enum: ['MANUAL', 'SCAN', 'API'], example: 'MANUAL' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['MANUAL', 'SCAN', 'API']),
    __metadata("design:type", String)
], CreateRedemptionDto.prototype, "channel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '订单来源（建单用）', enum: ['APPLET', 'WEB', 'IMPORT'], example: 'WEB' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['APPLET', 'WEB', 'IMPORT']),
    __metadata("design:type", String)
], CreateRedemptionDto.prototype, "orderSource", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '核销备注（写进审计 after）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], CreateRedemptionDto.prototype, "remark", void 0);
class QueryRedemptionsDto extends coupon_template_dto_1.PageQueryDto {
}
exports.QueryRedemptionsDto = QueryRedemptionsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '券码（模糊）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 32),
    __metadata("design:type", String)
], QueryRedemptionsDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '券模板 id' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryRedemptionsDto.prototype, "templateId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'C 端用户 id' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryRedemptionsDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '门店 id' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryRedemptionsDto.prototype, "storeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按商家筛选；附属商家只能传自己，传别人 403' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryRedemptionsDto.prototype, "merchantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['SUCCESS', 'REVERSED'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['SUCCESS', 'REVERSED']),
    __metadata("design:type", String)
], QueryRedemptionsDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '核销时间起点（含）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], QueryRedemptionsDto.prototype, "redeemedFrom", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '核销时间终点（含）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], QueryRedemptionsDto.prototype, "redeemedTo", void 0);
class ReverseRedemptionDto {
}
exports.ReverseRedemptionDto = ReverseRedemptionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '冲正原因（≥5 字符，写入核销记录与审计）', example: '订单取消，券退回用户' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 500),
    __metadata("design:type", String)
], ReverseRedemptionDto.prototype, "reason", void 0);
//# sourceMappingURL=redemption.dto.js.map