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
exports.UpdatePointRuleDto = exports.QueryExchangeRecordsDto = exports.ExchangePointsDto = exports.AdjustPointsDto = exports.EarnPointsDto = exports.QueryPointTransactionsDto = exports.QueryPointAccountsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const coupon_template_dto_1 = require("../../coupon/dto/coupon-template.dto");
const client_1 = require("@prisma/client");
class QueryPointAccountsDto extends coupon_template_dto_1.PageQueryDto {
}
exports.QueryPointAccountsDto = QueryPointAccountsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '用户昵称 / 手机号模糊搜索' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 30),
    __metadata("design:type", String)
], QueryPointAccountsDto.prototype, "keyword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '余额下限（含）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], QueryPointAccountsDto.prototype, "minBalance", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '仅看有临期积分（30 天内过期）的账户' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    __metadata("design:type", Boolean)
], QueryPointAccountsDto.prototype, "expiringSoon", void 0);
class QueryPointTransactionsDto extends coupon_template_dto_1.PageQueryDto {
}
exports.QueryPointTransactionsDto = QueryPointTransactionsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按用户过滤' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryPointTransactionsDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.PointTxnType, description: '流水类型：EARN/SPEND/EXPIRE/REFUND/ADJUST' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['EARN', 'SPEND', 'EXPIRE', 'REFUND', 'ADJUST']),
    __metadata("design:type", String)
], QueryPointTransactionsDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按产生积分的商家过滤（越权 → 403 FORBIDDEN_SCOPE）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryPointTransactionsDto.prototype, "merchantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按门店过滤' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryPointTransactionsDto.prototype, "storeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '开始日期（含），yyyy-mm-dd' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], QueryPointTransactionsDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '结束日期（含），yyyy-mm-dd' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], QueryPointTransactionsDto.prototype, "to", void 0);
class EarnPointsDto {
}
exports.EarnPointsDto = EarnPointsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1001, description: '积分归属用户' }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], EarnPointsDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 128, description: '消费金额（元），按积分规则 earnRatio 折算' }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(9_999_999),
    __metadata("design:type", Number)
], EarnPointsDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '订单 id。传入即启用「一单只送一次积分」幂等；不传则不幂等' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], EarnPointsDto.prototype, "orderId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '订单号（未传 orderId 时用它查订单，同样参与幂等）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 32),
    __metadata("design:type", String)
], EarnPointsDto.prototype, "orderNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '产生消费的商家（平台管理员必传；商家/店员由 JWT 推导）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], EarnPointsDto.prototype, "merchantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '产生消费的门店（店员账号由 JWT 推导，传错 → 403 STORE_NOT_OWNED）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], EarnPointsDto.prototype, "storeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '备注，写入流水 remark' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 255),
    __metadata("design:type", String)
], EarnPointsDto.prototype, "remark", void 0);
class AdjustPointsDto {
}
exports.AdjustPointsDto = AdjustPointsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1001 }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], AdjustPointsDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: -50,
        description: '调整积分，**带符号**：正数增加、负数扣减（扣减按 FIFO 走，过期批次不可用）',
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(-1_000_000),
    (0, class_validator_1.Max)(1_000_000),
    __metadata("design:type", Number)
], AdjustPointsDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '客诉补偿：系统故障导致少算积分', description: '调整原因（≥5 字符），写入流水 remark + 审计日志' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 255),
    __metadata("design:type", String)
], AdjustPointsDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '正向调整时指定该批次有效期；不传则按积分规则计算' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AdjustPointsDto.prototype, "expireAt", void 0);
class ExchangePointsDto {
}
exports.ExchangePointsDto = ExchangePointsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1001, description: '兑换用户（H5 为当前用户，后台可代客兑换）' }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], ExchangePointsDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1001, description: '要兑换的券模板' }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], ExchangePointsDto.prototype, "templateId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'b3f1c2d4-...', description: '幂等键（UUID），重复提交返回上次结果' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(8, 64),
    __metadata("design:type", String)
], ExchangePointsDto.prototype, "requestId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['H5', 'WEB'], description: '兑换渠道' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['H5', 'WEB']),
    __metadata("design:type", String)
], ExchangePointsDto.prototype, "channel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '备注' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(0, 255),
    __metadata("design:type", String)
], ExchangePointsDto.prototype, "remark", void 0);
class QueryExchangeRecordsDto extends coupon_template_dto_1.PageQueryDto {
}
exports.QueryExchangeRecordsDto = QueryExchangeRecordsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按用户过滤（H5 只传自己）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryExchangeRecordsDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按券模板过滤' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryExchangeRecordsDto.prototype, "templateId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '开始日期（含），yyyy-mm-dd' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], QueryExchangeRecordsDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '结束日期（含），yyyy-mm-dd' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], QueryExchangeRecordsDto.prototype, "to", void 0);
class UpdatePointRuleDto {
}
exports.UpdatePointRuleDto = UpdatePointRuleDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: '每消费 1 元获得积分' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(1000),
    __metadata("design:type", Number)
], UpdatePointRuleDto.prototype, "earnRatio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: '起送金额（元），低于该金额不送积分' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdatePointRuleDto.prototype, "minAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 12, description: '积分有效期（月）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(120),
    __metadata("design:type", Number)
], UpdatePointRuleDto.prototype, "pointsValidMonths", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['FIXED_MONTHS', 'YEAR_END'], description: '过期模式' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['FIXED_MONTHS', 'YEAR_END']),
    __metadata("design:type", String)
], UpdatePointRuleDto.prototype, "expireMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '1 生效 / 0 失效' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(1),
    __metadata("design:type", Number)
], UpdatePointRuleDto.prototype, "status", void 0);
//# sourceMappingURL=point.dto.js.map