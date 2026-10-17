"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const prisma_module_1 = require("./common/prisma/prisma.module");
const trace_middleware_1 = require("./common/middleware/trace.middleware");
const roles_guard_1 = require("./common/guards/roles.guard");
const auth_module_1 = require("./modules/auth/auth.module");
const jwt_auth_guard_1 = require("./modules/auth/jwt-auth.guard");
const health_module_1 = require("./modules/health/health.module");
const sse_module_1 = require("./modules/sse/sse.module");
const sub_module_1 = require("./modules/sub/sub.module");
const merchant_module_1 = require("./modules/merchant/merchant.module");
const upload_module_1 = require("./modules/upload/upload.module");
const authorization_module_1 = require("./modules/authorization/authorization.module");
const audit_log_module_1 = require("./modules/audit-log/audit-log.module");
const coupon_module_1 = require("./modules/coupon/coupon.module");
const point_module_1 = require("./modules/point/point.module");
const order_module_1 = require("./modules/order/order.module");
const purchase_module_1 = require("./modules/purchase/purchase.module");
const settlement_module_1 = require("./modules/settlement/settlement.module");
const report_module_1 = require("./modules/report/report.module");
const h5_module_1 = require("./modules/h5/h5.module");
const user_module_1 = require("./modules/user/user.module");
const store_module_1 = require("./modules/store/store.module");
const notification_module_1 = require("./modules/notification/notification.module");
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(trace_middleware_1.TraceMiddleware).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
            schedule_1.ScheduleModule.forRoot(),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            health_module_1.HealthModule,
            sse_module_1.SseModule,
            sub_module_1.SubModule,
            merchant_module_1.MerchantModule,
            upload_module_1.UploadModule,
            authorization_module_1.AuthorizationModule,
            audit_log_module_1.AuditLogModule,
            coupon_module_1.CouponModule,
            point_module_1.PointModule,
            order_module_1.OrderModule,
            purchase_module_1.PurchaseModule,
            settlement_module_1.SettlementModule,
            report_module_1.ReportModule,
            h5_module_1.H5Module,
            user_module_1.UserModule,
            store_module_1.StoreModule,
            notification_module_1.NotificationModule,
        ],
        providers: [
            { provide: core_1.APP_GUARD, useClass: jwt_auth_guard_1.JwtAuthGuard },
            { provide: core_1.APP_GUARD, useClass: roles_guard_1.RolesGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map