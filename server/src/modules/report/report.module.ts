import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

/**
 * 报表中心 + 工作台（S4.3）
 *
 * PrismaModule 是 @Global 全局模块（参考 SettlementModule 未显式导入即可注入），
 * 故此处只声明自己的控制器与服务。
 */
@Module({
  controllers: [ReportController, DashboardController],
  providers: [ReportService],
})
export class ReportModule {}
