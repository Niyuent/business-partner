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
exports.ConfirmSettlementDto = exports.QuerySettlementsDto = exports.GenerateSettlementDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class GenerateSettlementDto {
}
exports.GenerateSettlementDto = GenerateSettlementDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '对账商家 id（附属）；平台/主体可为 null 表示全平台' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], GenerateSettlementDto.prototype, "merchantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '周期开始（ISO8601）' }),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], GenerateSettlementDto.prototype, "periodStart", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '周期结束（ISO8601）' }),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], GenerateSettlementDto.prototype, "periodEnd", void 0);
class QuerySettlementsDto {
    constructor() {
        this.page = 1;
        this.pageSize = 10;
    }
}
exports.QuerySettlementsDto = QuerySettlementsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Object)
], QuerySettlementsDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Object)
], QuerySettlementsDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], QuerySettlementsDto.prototype, "merchantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['GENERATING', 'GENERATED', 'CONFIRMED', 'DISPUTED'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['GENERATING', 'GENERATED', 'CONFIRMED', 'DISPUTED']),
    __metadata("design:type", String)
], QuerySettlementsDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '账期开始下限（ISO8601）：periodStart >= 该值' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], QuerySettlementsDto.prototype, "periodStart", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '账期结束上限（ISO8601）：periodEnd <= 该值' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], QuerySettlementsDto.prototype, "periodEnd", void 0);
class ConfirmSettlementDto {
}
exports.ConfirmSettlementDto = ConfirmSettlementDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'true=确认(CONFIRMED)；false=提异议(DISPUTED，disputeReason 必填)' }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ConfirmSettlementDto.prototype, "confirm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '提异议原因（confirm=false 时必填，≥5 字符）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], ConfirmSettlementDto.prototype, "disputeReason", void 0);
//# sourceMappingURL=settlement.dto.js.map