"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PointModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const point_account_controller_1 = require("./point-account.controller");
const point_controller_1 = require("./point.controller");
const point_service_1 = require("./point.service");
const point_transaction_controller_1 = require("./point-transaction.controller");
const points_cron_service_1 = require("./points-cron.service");
const tasks_controller_1 = require("./tasks.controller");
let PointModule = class PointModule {
};
exports.PointModule = PointModule;
exports.PointModule = PointModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule],
        controllers: [
            point_account_controller_1.PointAccountController,
            point_transaction_controller_1.PointTransactionController,
            point_controller_1.PointController,
            point_controller_1.PointRuleController,
            tasks_controller_1.TasksController,
        ],
        providers: [point_service_1.PointService, points_cron_service_1.PointsCronService],
        exports: [point_service_1.PointService],
    })
], PointModule);
//# sourceMappingURL=point.module.js.map