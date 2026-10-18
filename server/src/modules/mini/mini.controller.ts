import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { UserJwtPayload } from '../auth/user-jwt-payload';
import { MiniBootstrapGuard } from './mini-bootstrap.guard';
import { MiniService } from './mini.service';

@ApiTags('mini')
@ApiBearerAuth()
@Controller('mini')
@Public()
@UseGuards(MiniBootstrapGuard)
export class MiniController {
  constructor(private readonly mini: MiniService) {}

  @Get('bootstrap')
  @ApiOperation({ summary: '小程序启动身份：商家（AdminUser 且有 merchantId）或会员' })
  bootstrap(@CurrentUser() user: UserJwtPayload | JwtPayload) {
    return this.mini.bootstrap(user);
  }

  @Get('workbench')
  @ApiOperation({ summary: '商家工作台：问候、门店、今日核销笔数与发放积分' })
  workbench(@CurrentUser() user: UserJwtPayload | JwtPayload) {
    return this.mini.workbench(user);
  }

  @Get('finance/checkup')
  @ApiOperation({ summary: '财务诊断：近 30 天实收与核销让利算出的健康分和现金支撑月数' })
  checkup(@CurrentUser() user: UserJwtPayload | JwtPayload) {
    return this.mini.financeCheckup(user);
  }
}
