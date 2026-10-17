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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const notification_dto_1 = require("./dto/notification.dto");
const notification_service_1 = require("./notification.service");
let NotificationController = class NotificationController {
    constructor(service) {
        this.service = service;
    }
    list(query, user) {
        return this.service.list(query, user);
    }
    unreadCount(user) {
        return this.service.unreadCount(user);
    }
    listSent(query, user) {
        return this.service.listSent(query, user);
    }
    batchReceivers(sendBatchId, user) {
        return this.service.batchReceivers(sendBatchId, user);
    }
    targets(user) {
        return this.service.targets(user);
    }
    markAllRead(user) {
        return this.service.markAllRead(user);
    }
    markRead(id, user) {
        return this.service.markRead(id, user);
    }
    send(dto, user, ip, ua) {
        return this.service.send(dto, user, ip, ua);
    }
};
exports.NotificationController = NotificationController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Permissions)('notification:view'),
    (0, swagger_1.ApiOperation)({ summary: '我的通知列表（分页；readStatus=UNREAD 只看未读；附带 unreadCount）' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [notification_dto_1.QueryNotificationDto, Object]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('unread-count'),
    (0, roles_decorator_1.Permissions)('notification:view'),
    (0, swagger_1.ApiOperation)({ summary: '我的未读通知数' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "unreadCount", null);
__decorate([
    (0, common_1.Get)('sent'),
    (0, roles_decorator_1.Permissions)('notification:send'),
    (0, swagger_1.ApiOperation)({
        summary: '我发过的通知（按发送批次聚合，一次发送 = 一条；权限 notification:send）',
        description: '「全部发送」展开的 N 行会聚合成 1 条并返回 receiverCount；同一秒内的两次同名发送不会被误合并。',
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [notification_dto_1.QuerySentNotificationDto, Object]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "listSent", null);
__decorate([
    (0, common_1.Get)('sent/:sendBatchId'),
    (0, roles_decorator_1.Permissions)('notification:send'),
    (0, swagger_1.ApiOperation)({
        summary: '某批发送的收件人明细（只能看自己发的批次）',
        description: '「发件箱」点击某条发送后展示本批发给了哪些商家 / 门店；非本人或不存在 → 404 RESOURCE_NOT_FOUND。',
    }),
    __param(0, (0, common_1.Param)('sendBatchId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "batchReceivers", null);
__decorate([
    (0, common_1.Get)('targets'),
    (0, roles_decorator_1.Permissions)('notification:send'),
    (0, swagger_1.ApiOperation)({
        summary: '可选发布目标（本主体可发布的附属商家 + 其营业中门店）',
        description: '与 POST /notifications **共用同一套 scope 断言**，保证「前端选得到的 = 后端允发的」。返回 { merchants: [...], stores: [...] }，stores 带 merchantId 便于分组展示。',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "targets", null);
__decorate([
    (0, common_1.Patch)('read-all'),
    (0, roles_decorator_1.Permissions)('notification:view'),
    (0, swagger_1.ApiOperation)({ summary: '我的通知全部标记已读（返回实际更新条数）' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "markAllRead", null);
__decorate([
    (0, common_1.Patch)(':id/read'),
    (0, roles_decorator_1.Permissions)('notification:view'),
    (0, swagger_1.ApiOperation)({
        summary: '标记单条已读（幂等：已读再标记返回 alreadyRead=true）',
        description: '不在自己接收范围内的通知返回 404 RESOURCE_NOT_FOUND（不泄露存在性）。',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "markRead", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Permissions)('notification:send'),
    (0, swagger_1.ApiOperation)({
        summary: '发布通知（主体 → 指定附属商家 / 指定门店 / 全部附属 / 全部门店）',
        description: '目标只能是本主体直属附属商家及其门店，范围外商家 403 FORBIDDEN_SCOPE、门店 403 STORE_NOT_OWNED。' +
            'ALL_* 发布时展开为一人一行（已读状态按行记录）。同事务写审计 notification:send。',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [notification_dto_1.SendNotificationDto, Object, String, String]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "send", null);
exports.NotificationController = NotificationController = __decorate([
    (0, swagger_1.ApiTags)('notifications'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('notifications'),
    __metadata("design:paramtypes", [notification_service_1.NotificationService])
], NotificationController);
//# sourceMappingURL=notification.controller.js.map