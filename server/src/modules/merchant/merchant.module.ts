import { Module } from '@nestjs/common';
import { RateLimitService } from '../../common/services/rate-limit.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';

@Module({
  imports: [AuditLogModule],
  controllers: [MerchantController],
  providers: [MerchantService, RateLimitService],
})
export class MerchantModule {}
