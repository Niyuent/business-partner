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
exports.QueryAuditLogsDto = exports.PageQueryDto = void 0;
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
class QueryAuditLogsDto extends PageQueryDto {
}
exports.QueryAuditLogsDto = QueryAuditLogsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '业务模块过滤，如 merchant / authorization / auth',
        example: 'authorization',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 32),
    __metadata("design:type", String)
], QueryAuditLogsDto.prototype, "module", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按操作人 id 精确过滤' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], QueryAuditLogsDto.prototype, "operatorId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按操作人姓名/账号模糊过滤（operatorName OR adminUser.username）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 32),
    __metadata("design:type", String)
], QueryAuditLogsDto.prototype, "operatorKeyword", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '按动作过滤，如 application:approve / authorization:revoke / merchant:suspend',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 64),
    __metadata("design:type", String)
], QueryAuditLogsDto.prototype, "action", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按目标类型过滤，如 merchant / merchant_authorization' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 32),
    __metadata("design:type", String)
], QueryAuditLogsDto.prototype, "targetType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '按目标 id 过滤' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], QueryAuditLogsDto.prototype, "targetId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['SUCCESS', 'FAILED'], description: '按执行结果过滤' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 16),
    __metadata("design:type", String)
], QueryAuditLogsDto.prototype, "result", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '起始时间（ISO8601）', example: '2026-10-01T00:00:00+08:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], QueryAuditLogsDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '截止时间（ISO8601）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], QueryAuditLogsDto.prototype, "to", void 0);
//# sourceMappingURL=audit-log.dto.js.map