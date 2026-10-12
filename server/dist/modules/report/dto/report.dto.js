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
exports.ReportKeyParamDto = exports.TrendQueryDto = exports.ReportQueryDto = exports.REPORT_KEYS = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.REPORT_KEYS = [
    'merchant-onboarding',
    'orders-summary',
    'coupon-summary',
    'points-summary',
    'store-settlement',
    'authorization-logs',
];
class ReportQueryDto {
    constructor() {
        this.page = 1;
        this.pageSize = 20;
    }
}
exports.ReportQueryDto = ReportQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Object)
], ReportQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '每页条数，1-200' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Object)
], ReportQueryDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '开始时间（ISO8601），按各报表的主时间字段过滤' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], ReportQueryDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '结束时间（ISO8601）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], ReportQueryDto.prototype, "to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '商家 id；附属身份会被强制收敛为自己的商家' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], ReportQueryDto.prototype, "merchantId", void 0);
class TrendQueryDto {
    constructor() {
        this.days = 7;
    }
}
exports.TrendQueryDto = TrendQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '天数，1-90，默认 7' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(90),
    __metadata("design:type", Object)
], TrendQueryDto.prototype, "days", void 0);
class ReportKeyParamDto {
}
exports.ReportKeyParamDto = ReportKeyParamDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.REPORT_KEYS, description: '报表 key' }),
    (0, class_validator_1.IsIn)(exports.REPORT_KEYS),
    __metadata("design:type", String)
], ReportKeyParamDto.prototype, "key", void 0);
//# sourceMappingURL=report.dto.js.map