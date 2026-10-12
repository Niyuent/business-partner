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
exports.TasksController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const point_service_1 = require("./point.service");
let TasksController = class TasksController {
    constructor(points) {
        this.points = points;
    }
    expire(user, ip, ua) {
        return this.points.expirePoints({
            operatorId: user.sub,
            operatorType: user.userType,
            ip,
            userAgent: ua,
            triggeredBy: 'manual',
        });
    }
};
exports.TasksController = TasksController;
__decorate([
    (0, common_1.Post)('expire'),
    (0, roles_decorator_1.Permissions)('point:expire:trigger'),
    (0, swagger_1.ApiOperation)({
        summary: '手动触发积分过期清零（S3.3）',
        description: '扫描 `type=EARN AND remainingAmount>0 AND expireAt<NOW()` 的批次并清零：幂等（同一批次只会清零一次）+ ' +
            '分批（单次最多 500 条，避免大事务锁表）。需 `point:expire:trigger`，操作写审计日志。' +
            '定时任务每天 01:00（Asia/Shanghai）自动跑，无需权限。',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Ip)()),
    __param(2, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "expire", null);
exports.TasksController = TasksController = __decorate([
    (0, swagger_1.ApiTags)('tasks'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('tasks/points'),
    __metadata("design:paramtypes", [point_service_1.PointService])
], TasksController);
//# sourceMappingURL=tasks.controller.js.map