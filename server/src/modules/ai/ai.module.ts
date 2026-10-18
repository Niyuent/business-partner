import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { AiController } from './ai.controller';
import { AiCronService } from './ai-cron.service';
import { AiService } from './ai.service';
import { DeepseekService } from './deepseek.service';
import { LayaService } from './laya.service';

/** 经营日报（AI-1 接入 + AI-2 生成与推送） */
@Module({
  imports: [NotificationModule],
  controllers: [AiController],
  providers: [LayaService, DeepseekService, AiService, AiCronService],
})
export class AiModule {}
