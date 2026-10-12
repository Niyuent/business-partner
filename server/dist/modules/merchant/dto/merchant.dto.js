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
exports.UpdateMerchantStatusDto = exports.QueryMerchantsDto = exports.PageQueryDto = void 0;
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
class QueryMerchantsDto extends PageQueryDto {
}
exports.QueryMerchantsDto = QueryMerchantsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED'],
        description: '按状态筛选',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED']),
    __metadata("design:type", String)
], QueryMerchantsDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['MAIN', 'SUB'], description: '按类型筛选' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['MAIN', 'SUB']),
    __metadata("design:type", String)
], QueryMerchantsDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按名称/编码模糊搜索' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 50),
    __metadata("design:type", String)
], QueryMerchantsDto.prototype, "keyword", void 0);
class UpdateMerchantStatusDto {
}
exports.UpdateMerchantStatusDto = UpdateMerchantStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: ['APPROVED', 'SUSPENDED'],
        description: '启用(APPROVED) / 暂停(SUSPENDED)；入驻审核请用 /applications 的 approve/reject',
    }),
    (0, class_validator_1.IsIn)(['APPROVED', 'SUSPENDED']),
    __metadata("design:type", String)
], UpdateMerchantStatusDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '变更原因，暂停时建议填写' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 255),
    __metadata("design:type", String)
], UpdateMerchantStatusDto.prototype, "remark", void 0);
//# sourceMappingURL=merchant.dto.js.map