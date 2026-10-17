import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

/**
 * 站内信（S5.4-A）
 *
 * 依赖 AuditLogModule：发布通知写审计。
 * PrismaModule 为 @Global，无需显式 import。
 */
@Module({
  imports: [AuditLogModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
