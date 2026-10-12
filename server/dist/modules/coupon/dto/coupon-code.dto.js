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
exports.QueryBatchesDto = exports.QueryCodesDto = exports.GenerateCodesDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const coupon_template_dto_1 = require("./coupon-template.dto");
class GenerateCodesDto {
}
exports.GenerateCodesDto = GenerateCodesDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '批次号，不传则自动生成 1001-20261007-001 形式；已存在则返回 409 BATCH_ALREADY_EXISTS',
        example: '1001-20261007-001',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 32),
    __metadata("design:type", String)
], GenerateCodesDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '生成数量', example: 100 }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5000),
    __metadata("design:type", Number)
], GenerateCodesDto.prototype, "quantity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '批次备注（如：双十一预热）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 200),
    __metadata("design:type", String)
], GenerateCodesDto.prototype, "remark", void 0);
class QueryCodesDto extends coupon_template_dto_1.PageQueryDto {
}
exports.QueryCodesDto = QueryCodesDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['UNISSUED', 'ISSUED', 'REDEEMED', 'VOID'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['UNISSUED', 'ISSUED', 'REDEEMED', 'VOID']),
    __metadata("design:type", String)
], QueryCodesDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按批次号精确过滤' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 32),
    __metadata("design:type", String)
], QueryCodesDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按批次 id 精确过滤（与 batchNo 等价，前端下拉直接用 id）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryCodesDto.prototype, "batchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按券码模糊搜索' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 32),
    __metadata("design:type", String)
], QueryCodesDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '是否返回券码明文；false 时仅返回 id + 状态（导出场景用）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    __metadata("design:type", Boolean)
], QueryCodesDto.prototype, "withCode", void 0);
class QueryBatchesDto extends coupon_template_dto_1.PageQueryDto {
}
exports.QueryBatchesDto = QueryBatchesDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '模板 id' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryBatchesDto.prototype, "templateId", void 0);
//# sourceMappingURL=coupon-code.dto.js.map