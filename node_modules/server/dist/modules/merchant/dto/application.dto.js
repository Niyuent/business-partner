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
exports.RejectApplicationDto = exports.ApproveApplicationDto = exports.QueryApplicationsDto = exports.CreateApplicationDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const merchant_dto_1 = require("./merchant.dto");
class CreateApplicationDto {
}
exports.CreateApplicationDto = CreateApplicationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '城北便利店' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 100),
    __metadata("design:type", String)
], CreateApplicationDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '陈城北' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 50),
    __metadata("design:type", String)
], CreateApplicationDto.prototype, "contactName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '13900000009' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^1[3-9]\d{9}$/, { message: '联系人手机号格式不正确' }),
    __metadata("design:type", String)
], CreateApplicationDto.prototype, "contactPhone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '91310000MA1FL0009X' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(5, 64),
    __metadata("design:type", String)
], CreateApplicationDto.prototype, "licenseNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '上海市' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 32),
    __metadata("design:type", String)
], CreateApplicationDto.prototype, "province", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '上海市' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 32),
    __metadata("design:type", String)
], CreateApplicationDto.prototype, "city", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '杨浦区' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 32),
    __metadata("design:type", String)
], CreateApplicationDto.prototype, "district", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '控江路 800 号' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 255),
    __metadata("design:type", String)
], CreateApplicationDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '营业执照图片地址数组，来自 POST /upload',
        example: ['/uploads/2026/10/xxxx.jpg'],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateApplicationDto.prototype, "licenseImages", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '线下结算联系人（仅记录，系统不参与资金结算）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 255),
    __metadata("design:type", String)
], CreateApplicationDto.prototype, "settleContact", void 0);
class QueryApplicationsDto extends merchant_dto_1.PageQueryDto {
}
exports.QueryApplicationsDto = QueryApplicationsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED'],
        description: '默认 PENDING（待审核）',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryApplicationsDto.prototype, "status", void 0);
class ApproveApplicationDto {
}
exports.ApproveApplicationDto = ApproveApplicationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '审核备注' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 255),
    __metadata("design:type", String)
], ApproveApplicationDto.prototype, "auditRemark", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '是否自动为附属商家创建管理员账号，默认 true',
        default: true,
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], ApproveApplicationDto.prototype, "createAccount", void 0);
class RejectApplicationDto {
}
exports.RejectApplicationDto = RejectApplicationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '驳回原因，必填' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 255),
    __metadata("design:type", String)
], RejectApplicationDto.prototype, "auditRemark", void 0);
//# sourceMappingURL=application.dto.js.map