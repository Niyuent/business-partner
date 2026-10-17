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
exports.QuerySentNotificationDto = exports.QueryNotificationDto = exports.SendNotificationDto = exports.NOTIFICATION_TARGET_TYPES = void 0;
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.NOTIFICATION_TARGET_TYPES = ['MERCHANT', 'STORE', 'ALL_MERCHANTS', 'ALL_STORES'];
const trim = ({ value }) => (typeof value === 'string' ? value.trim() : value);
class SendNotificationDto {
}
exports.SendNotificationDto = SendNotificationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: exports.NOTIFICATION_TARGET_TYPES, description: '发布目标类型' }),
    (0, class_validator_1.IsIn)(exports.NOTIFICATION_TARGET_TYPES),
    __metadata("design:type", String)
], SendNotificationDto.prototype, "targetType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [Number],
        description: 'targetType=MERCHANT / STORE 时必填（商家 id / 门店 id，≤200 个）；ALL_* 时不可传',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ each: true }),
    (0, class_validator_1.Min)(1, { each: true }),
    __metadata("design:type", Array)
], SendNotificationDto.prototype, "targetIds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 100 }),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], SendNotificationDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 1000 }),
    (0, class_transformer_1.Transform)(trim),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], SendNotificationDto.prototype, "content", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.NotificationType, default: client_1.NotificationType.SYSTEM }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.NotificationType),
    __metadata("design:type", String)
], SendNotificationDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.NotifyLevel, default: client_1.NotifyLevel.NORMAL }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.NotifyLevel),
    __metadata("design:type", String)
], SendNotificationDto.prototype, "level", void 0);
class QueryNotificationDto {
    constructor() {
        this.page = 1;
        this.pageSize = 20;
    }
}
exports.QueryNotificationDto = QueryNotificationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], QueryNotificationDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 20, maximum: 100 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], QueryNotificationDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.ReadStatus, description: '传 UNREAD 只看未读' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ReadStatus),
    __metadata("design:type", String)
], QueryNotificationDto.prototype, "readStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.NotificationType }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.NotificationType),
    __metadata("design:type", String)
], QueryNotificationDto.prototype, "type", void 0);
class QuerySentNotificationDto {
    constructor() {
        this.page = 1;
        this.pageSize = 20;
    }
}
exports.QuerySentNotificationDto = QuerySentNotificationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], QuerySentNotificationDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 20, maximum: 100 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], QuerySentNotificationDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.NotificationType }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.NotificationType),
    __metadata("design:type", String)
], QuerySentNotificationDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '标题模糊搜索' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], QuerySentNotificationDto.prototype, "keyword", void 0);
//# sourceMappingURL=notification.dto.js.map