import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { TraceMiddleware } from './common/middleware/trace.middleware';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { HealthModule } from './modules/health/health.module';
import { SseModule } from './modules/sse/sse.module';
import { SubModule } from './modules/sub/sub.module';
import { MerchantModule } from './modules/merchant/merchant.module';
import { UploadModule } from './modules/upload/upload.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { CouponModule } from './modules/coupon/coupon.module';
import { PointModule } from './modules/point/point.module';
import { OrderModule } from './modules/order/order.module';
import { PurchaseModule } from './modules/purchase/purchase.module';
import { SettlementModule } from './modules/settlement/settlement.module';

/**
 * 全站默认鉴权策略：**拒绝未声明的**。
 *
 * JwtAuthGuard → RolesGuard 依次执行：
 *  - 没打 `@Public()` 的接口必须先登录；
 *  - 打了 `@Roles()` / `@Permissions()` 的接口还需角色或权限码命中。
 * 新增 Controller 若忘记挂守卫，默认是「需要登录」，不会裸奔。
 *
 * MerchantScopeGuard 不做全局，因为它只认 `/sub/**` 这类需要按商家隔离的接口，
 * 由对应 Controller 显式 `@UseGuards(MerchantScopeGuard)`。
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    // S3.3：积分过期清零定时任务（@Cron 需要在根模块 forRoot）
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    HealthModule,
    SseModule,
    SubModule,
    MerchantModule,
    UploadModule,
    AuthorizationModule,
    // S1.4：AuditLogModule 既提供写入（各业务模块依赖），也提供查询控制器
    AuditLogModule,
    // S2.1：券模板管理（券码生成 / 发放 / 核销在 S2.2-S2.4 继续加进这个模块）
    CouponModule,
    // S3.1：积分账户 / 积分流水 / 消费录单送积分 / 人工调整（S3.2-S3.4 继续加进这个模块）
    PointModule,
    // S3.4：订单管理 + 异常订单处理
    OrderModule,
    // S4.1：采购记录
    PurchaseModule,
    // S4.2：对账账单
    SettlementModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TraceMiddleware).forRoutes('*');
  }
}
