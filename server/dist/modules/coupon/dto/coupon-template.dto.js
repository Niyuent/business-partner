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
exports.UpdateCouponTemplateDto = exports.CreateCouponTemplateDto = exports.QueryCouponTemplatesDto = exports.PageQueryDto = void 0;
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
class QueryCouponTemplatesDto extends PageQueryDto {
}
exports.QueryCouponTemplatesDto = QueryCouponTemplatesDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '模板名 / 副标题模糊搜索' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 50),
    __metadata("design:type", String)
], QueryCouponTemplatesDto.prototype, "keyword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['MAIN_COUPON', 'SUB_COUPON'], description: '主体券 / 附属商家券' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['MAIN_COUPON', 'SUB_COUPON']),
    __metadata("design:type", String)
], QueryCouponTemplatesDto.prototype, "ownerType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'VOID'],
        description: '模板状态',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'VOID']),
    __metadata("design:type", String)
], QueryCouponTemplatesDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '按归属商家筛选；主体商家只能看自己拥有/自己创建的，附属商家只能看自己的',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], QueryCouponTemplatesDto.prototype, "ownerMerchantId", void 0);
class CreateCouponTemplateDto {
    constructor() {
        this.couponType = 'VOUCHER';
        this.validType = 'AFTER_RECEIVE_DAYS';
        this.applyScope = 'ALL_STORES';
    }
}
exports.CreateCouponTemplateDto = CreateCouponTemplateDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '创建者主体 id；**仅平台管理员可指定**，主体管理员传别人的值 403',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreateCouponTemplateDto.prototype, "mainMerchantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['MAIN_COUPON', 'SUB_COUPON'], description: '券归属类型' }),
    (0, class_validator_1.IsIn)(['MAIN_COUPON', 'SUB_COUPON']),
    __metadata("design:type", String)
], CreateCouponTemplateDto.prototype, "ownerType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '券归属商家 id；ownerType=SUB_COUPON 时必填，且必须是本主体的直接下属（已通过审核）',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreateCouponTemplateDto.prototype, "ownerMerchantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'T5 新客专享券' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], CreateCouponTemplateDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '仅限新客首单使用' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], CreateCouponTemplateDto.prototype, "subtitle", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['VOUCHER', 'DISCOUNT'], default: 'VOUCHER' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['VOUCHER', 'DISCOUNT']),
    __metadata("design:type", String)
], CreateCouponTemplateDto.prototype, "couponType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '面值（元）', example: 20 }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreateCouponTemplateDto.prototype, "faceValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '使用门槛（元），0 表示无门槛', example: 100 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateCouponTemplateDto.prototype, "thresholdAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '积分兑换所需积分', example: 20 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateCouponTemplateDto.prototype, "pointsCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '采购结算价（元）', example: 15 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateCouponTemplateDto.prototype, "purchasePrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '发行总量', example: 500 }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateCouponTemplateDto.prototype, "totalStock", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['FIXED', 'AFTER_RECEIVE_DAYS'],
        default: 'AFTER_RECEIVE_DAYS',
        description: 'FIXED 需传 validStart/validEnd；AFTER_RECEIVE_DAYS 需传 validDays',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['FIXED', 'AFTER_RECEIVE_DAYS']),
    __metadata("design:type", String)
], CreateCouponTemplateDto.prototype, "validType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'validType=FIXED 时的生效时间' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateCouponTemplateDto.prototype, "validStart", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'validType=FIXED 时的失效时间（必须晚于 validStart）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateCouponTemplateDto.prototype, "validEnd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'validType=AFTER_RECEIVE_DAYS 时的有效天数', example: 30 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(3650),
    __metadata("design:type", Number)
], CreateCouponTemplateDto.prototype, "validDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['ALL_STORES', 'SPECIFIED_STORES', 'SPECIFIED_MERCHANTS'],
        default: 'ALL_STORES',
        description: 'SPECIFIED_MERCHANTS 为 S4 预留，S2.1 传了会 400',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['ALL_STORES', 'SPECIFIED_STORES', 'SPECIFIED_MERCHANTS']),
    __metadata("design:type", String)
], CreateCouponTemplateDto.prototype, "applyScope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'applyScope=SPECIFIED_STORES 时必填，门店必须属于券的归属商家',
        example: [101],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ each: true }),
    (0, class_validator_1.IsPositive)({ each: true }),
    __metadata("design:type", Array)
], CreateCouponTemplateDto.prototype, "storeIds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '每人限领/限用张数', example: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateCouponTemplateDto.prototype, "perUserLimit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '满 100 元可用，不兑现不找零' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 500),
    __metadata("design:type", String)
], CreateCouponTemplateDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '同一订单仅可使用 1 张，不可叠加' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 500),
    __metadata("design:type", String)
], CreateCouponTemplateDto.prototype, "rules", void 0);
class UpdateCouponTemplateDto {
}
exports.UpdateCouponTemplateDto = UpdateCouponTemplateDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'T5 新客专享券（改价）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], UpdateCouponTemplateDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], UpdateCouponTemplateDto.prototype, "subtitle", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '面值（元）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], UpdateCouponTemplateDto.prototype, "faceValue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '使用门槛（元）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateCouponTemplateDto.prototype, "thresholdAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateCouponTemplateDto.prototype, "pointsCost", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateCouponTemplateDto.prototype, "purchasePrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '发行总量：只能调大，且不能小于已发放数量 issuedCount',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateCouponTemplateDto.prototype, "totalStock", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['FIXED', 'AFTER_RECEIVE_DAYS'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['FIXED', 'AFTER_RECEIVE_DAYS']),
    __metadata("design:type", String)
], UpdateCouponTemplateDto.prototype, "validType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateCouponTemplateDto.prototype, "validStart", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateCouponTemplateDto.prototype, "validEnd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(3650),
    __metadata("design:type", Number)
], UpdateCouponTemplateDto.prototype, "validDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['ALL_STORES', 'SPECIFIED_STORES'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['ALL_STORES', 'SPECIFIED_STORES']),
    __metadata("design:type", Object)
], UpdateCouponTemplateDto.prototype, "applyScope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'applyScope=SPECIFIED_STORES 时为门店清单（整体覆盖）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ each: true }),
    (0, class_validator_1.IsPositive)({ each: true }),
    __metadata("design:type", Array)
], UpdateCouponTemplateDto.prototype, "storeIds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateCouponTemplateDto.prototype, "perUserLimit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 500),
    __metadata("design:type", String)
], UpdateCouponTemplateDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 500),
    __metadata("design:type", String)
], UpdateCouponTemplateDto.prototype, "rules", void 0);
//# sourceMappingURL=coupon-template.dto.js.map