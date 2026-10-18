import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserJwtAuthGuard } from '../auth/user-jwt-auth.guard';
import { UserJwtPayload } from '../auth/user-jwt-payload';
import { ExchangePointsDto, QueryExchangeRecordsDto, QueryPointTransactionsDto } from '../point/dto/point.dto';
import { H5Service } from './h5.service';

/**
 * C 端 / H5 接口（S5.1）
 *
 * 鉴权：对全局 `JwtAuthGuard` 标记 `@Public()`（跳过后台鉴权），改由 `UserJwtAuthGuard` 强制 **C 端令牌**；
 * 后台令牌访问本前缀 → 403。所有数据以令牌 `userId` 为准，越权（伪造 userId）→ 403。
 */
@ApiTags('h5')
@ApiBearerAuth()
@Controller('h5')
@Public()
@UseGuards(UserJwtAuthGuard)
export class H5Controller {
  constructor(private readonly h5: H5Service) {}

  @Get('me')
  @ApiOperation({ summary: '当前 C 端用户资料' })
  me(@CurrentUser() user: UserJwtPayload) {
    return this.h5.me(user);
  }

  @Get('points/account')
  @ApiOperation({ summary: '我的积分账户（余额 / 批次 / 可用与临期）' })
  account(@CurrentUser() user: UserJwtPayload) {
    return this.h5.account(user);
  }

  @Get('points/transactions')
  @ApiOperation({ summary: '我的积分流水' })
  transactions(@CurrentUser() user: UserJwtPayload, @Query() query: QueryPointTransactionsDto) {
    return this.h5.transactions(user, query);
  }

  @Get('coupon-templates')
  @ApiOperation({ summary: '可兑换券列表（分页）' })
  couponTemplates(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.h5.couponTemplates(Number(page) || 1, Number(pageSize) || 10);
  }

  @Get('my/coupons')
  @ApiOperation({ summary: '我的卡包（未使用 / 已使用 / 已过期，分页）' })
  myCoupons(
    @CurrentUser() user: UserJwtPayload,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const tab = status === 'USED' || status === 'EXPIRED' ? status : 'UNUSED';
    return this.h5.myCoupons(user, tab, Number(page) || 1, Number(pageSize) || 10);
  }

  @Post('points/exchange')
  @ApiOperation({ summary: '积分兑换代金券（与 /h5/exchange 同一实现）' })
  exchangePoints(@CurrentUser() user: UserJwtPayload, @Body() dto: ExchangePointsDto) {
    return this.h5.exchange(user, dto);
  }

  @Get('templates')
  @ApiOperation({ summary: '可兑换券列表（已上架 + 有库存 + 设了兑换积分）' })
  templates() {
    return this.h5.templates();
  }

  @Get('exchange-records')
  @ApiOperation({ summary: '我的兑换记录' })
  exchangeRecords(@CurrentUser() user: UserJwtPayload, @Query() query: QueryExchangeRecordsDto) {
    return this.h5.exchangeRecords(user, query);
  }

  @Post('exchange')
  @ApiOperation({ summary: '积分兑换代金券（userId 取自令牌；伪造 userId → 403）' })
  exchange(@CurrentUser() user: UserJwtPayload, @Body() dto: ExchangePointsDto) {
    return this.h5.exchange(user, dto);
  }
}
