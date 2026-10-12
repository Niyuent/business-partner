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
exports.HandleOrderDto = exports.MarkAbnormalDto = exports.CreateOrderDto = exports.QueryOrdersDto = exports.HANDLE_TYPES = exports.ABNORMAL_TYPES = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.ABNORMAL_TYPES = ['AMOUNT_ERROR', 'DUPLICATE_COUPON', 'REFUND_NOT_RETURNED', 'STORE_DISPUTE'];
exports.HANDLE_TYPES = ['CANCEL', 'AMOUNT_ERROR', 'DISPUTE'];
class QueryOrdersDto {
    constructor() {
        this.page = 1;
        this.pageSize = 10;
    }
}
exports.QueryOrdersDto = QueryOrdersDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Object)
], QueryOrdersDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Object)
], QueryOrdersDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['NORMAL', 'ABNORMAL', 'REFUNDED', 'CANCELED'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['NORMAL', 'ABNORMAL', 'REFUNDED', 'CANCELED']),
    __metadata("design:type", String)
], QueryOrdersDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryOrdersDto.prototype, "orderNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], QueryOrdersDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], QueryOrdersDto.prototype, "merchantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], QueryOrdersDto.prototype, "storeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryOrdersDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryOrdersDto.prototype, "to", void 0);
class CreateOrderDto {
}
exports.CreateOrderDto = CreateOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '订单号（唯一，一单只送一次积分靠它做幂等键）' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "orderNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '用户 id' }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateOrderDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '商家 id（平台管理员补录必填）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateOrderDto.prototype, "merchantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '门店 id' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateOrderDto.prototype, "storeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['CONSUME', 'EXCHANGE'], default: 'CONSUME' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['CONSUME', 'EXCHANGE']),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "orderType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '订单总金额' }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateOrderDto.prototype, "totalAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateOrderDto.prototype, "discountAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateOrderDto.prototype, "payAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['APPLET', 'WEB', 'IMPORT'], default: 'IMPORT' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['APPLET', 'WEB', 'IMPORT']),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "source", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '消费金额（>0 时走 /points/earn 送积分）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateOrderDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "remark", void 0);
class MarkAbnormalDto {
}
exports.MarkAbnormalDto = MarkAbnormalDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: exports.ABNORMAL_TYPES, description: '异常类型' }),
    (0, class_validator_1.IsIn)(exports.ABNORMAL_TYPES),
    __metadata("design:type", Object)
], MarkAbnormalDto.prototype, "abnormalType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '异常说明（必填，≥5 字符）' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], MarkAbnormalDto.prototype, "abnormalRemark", void 0);
class HandleOrderDto {
}
exports.HandleOrderDto = HandleOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: exports.HANDLE_TYPES, description: '处理类型' }),
    (0, class_validator_1.IsIn)(exports.HANDLE_TYPES),
    __metadata("design:type", Object)
], HandleOrderDto.prototype, "handleType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '处理结果说明' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], HandleOrderDto.prototype, "result", void 0);
//# sourceMappingURL=order.dto.js.map