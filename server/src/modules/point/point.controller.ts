import { Body, Controller, Get, Headers, Ip, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import {
  AdjustPointsDto,
  EarnPointsDto,
  ExchangePointsDto,
  QueryExchangeRecordsDto,
  UpdatePointRuleDto,
} from './dto/point.dto';
import { PointService } from './point.service';

/**
 * 积分写操作（S3.1）：消费录单送积分 / 人工调整 / 规则维护
 */
@ApiTags('points')
@ApiBearerAuth()
@Controller('points')
export class PointController {
  constructor(private readonly points: PointService) {}

  @Post('earn')
  @Permissions('point:earn')
  @ApiOperation({
    summary: '消费录单送积分（内部接口，S3.4 订单模块复用）',
    description:
      '流程：归属解析（商家/门店由 JWT 推导）→ 规则（商家级优先，其次平台级）→ 折算积分 → 事务内写 EARN 批次 + 账户乐观锁更新（冲突重试 3 次，超过 409 `CONCURRENT_UPDATE`）→ 审计。' +
      '传 `orderId`/`orderNo` 启用**一单只送一次**幂等（唯一索引 `(relatedOrderId, type)` 兜底，重复 → 409 `ORDER_POINTS_ALREADY_EARNED`）。',
  })
  earn(
    @Body() dto: EarnPointsDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.points.earn(dto, user, ip, ua);
  }

  @Post('exchange')
  @Permissions('point:exchange')
  @ApiOperation({
    summary: '积分兑换代金券（FIFO 扣减 + 券码分配 + 券实例，全同事务）',
    description:
      '9 步顺序：① 幂等键（相同 requestId 返回上次结果，200 + idempotent:true）→ ② 模板（404 / 409 TEMPLATE_NOT_AVAILABLE / STOCK_EXHAUSTED / PER_USER_LIMIT_EXCEEDED）→ ' +
      '③ 可用积分（过期批次不算，409 BALANCE_NOT_ENOUGH）→ ④ FIFO 扣减 + SPEND 流水（指回券实例）→ ⑤ 券码 FOR UPDATE + 条件更新（409 CODE_POOL_EXHAUSTED）→ ' +
      '⑥ 券实例（issuer=主体商家，source=EXCHANGE）→ ⑦ 账户乐观锁扣减（冲突重试 3 次，409 CONCURRENT_UPDATE）→ ⑧ issuedCount 条件更新 → ⑨ 兑换记录 + 审计。任一步失败整事务回滚。',
  })
  exchange(
    @Body() dto: ExchangePointsDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.points.exchange(dto, user, ip, ua);
  }

  @Get('exchange-records')
  @Permissions('point:exchange:view')
  @ApiOperation({
    summary: '兑换记录（用户视角：userId 传自己；后台可按用户 / 模板 / 时间筛选）',
    description: '返回券码、券状态、有效期与本次消耗的积分，H5「我的兑换」直接用。',
  })
  exchangeRecords(@Query() query: QueryExchangeRecordsDto, @CurrentUser() user: JwtPayload) {
    return this.points.listExchangeRecords(query, user);
  }

  @Post('adjust')
  @Permissions('point:adjust')
  @ApiOperation({
    summary: '人工调整积分（正增负减，原因必填 ≥5 字符）',
    description:
      '负向调整走 **FIFO 扣减**（与兑换一致，过期批次不可用，避免「调账把过期积分盘活」）。' +
      '写 ADJUST 流水 + `audit_logs`（谁改的、改前改后、原因）。余额不足 → 409 `BALANCE_NOT_ENOUGH`。',
  })
  adjust(
    @Body() dto: AdjustPointsDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.points.adjust(dto, user, ip, ua);
  }
}

/**
 * 积分规则（S3.1）
 *
 * `merchantId=0` 是**平台级默认规则**；商家没有自己的生效规则时回落到这里。
 */
@ApiTags('point-rules')
@ApiBearerAuth()
@Controller('point-rules')
export class PointRuleController {
  constructor(private readonly points: PointService) {}

  @Get()
  @Permissions('point:rule:view', 'point:view')
  @ApiOperation({ summary: '积分规则列表（平台看全部，商家看自己 + 平台默认）' })
  list(@CurrentUser() user: JwtPayload) {
    return this.points.listRules(user);
  }

  @Put(':id')
  @Permissions('point:rule:edit')
  @ApiOperation({
    summary: '修改积分规则（写审计 before/after）',
    description: '改平台规则需平台管理员；同一商家只能有一条生效规则（唯一约束 → 409 `POINT_RULE_ALREADY_ACTIVE`）。',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePointRuleDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.points.updateRule(id, dto, user, ip, ua);
  }
}
