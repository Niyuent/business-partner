import { Injectable, Logger } from '@nestjs/common';
import {
  CouponSource,
  CouponTemplateStatus,
  ExpireMode,
  MerchantType,
  PointTxnType,
  Prisma,
} from '@prisma/client';
import { BizException, ReasonCode } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit-log/audit.service';
import { JwtPayload } from '../auth/jwt-payload';
import {
  AdjustPointsDto,
  EarnPointsDto,
  ExchangePointsDto,
  QueryExchangeRecordsDto,
  QueryPointAccountsDto,
  QueryPointTransactionsDto,
  UpdatePointRuleDto,
} from './dto/point.dto';

/** 审计动作名 */
const ACTION = {
  earn: 'point:earn',
  adjust: 'point:adjust',
  exchange: 'point:exchange',
  ruleUpdate: 'point:rule:update',
  expire: 'POINTS_EXPIRE',
} as const;

/** 乐观锁重试上限：3 次都撞不上就报冲突，绝不无限重试把请求挂死 */
const MAX_RETRY = 3;

/** 临期判定窗口（天）：账户详情里「即将过期」的口径 */
const EXPIRING_SOON_DAYS = 30;

/** 可以作为「批次」被 FIFO 消耗的流水类型：只有它们持有 remainingAmount */
const BATCH_TYPES: PointTxnType[] = [PointTxnType.EARN, PointTxnType.ADJUST, PointTxnType.REFUND];

/**
 * 内部信号：账户版本被别人抢先改了，需要**整事务重跑**。
 * 刻意不继承 BizException——它不该被异常过滤器翻译成 HTTP 响应，只在重试循环里被识别。
 */
export class ConcurrentSignal extends Error {
  constructor() {
    super('CONCURRENT_ACCOUNT_UPDATE');
  }
}

/** FIFO 扣减结果：每一笔从哪个批次扣了多少，S3.2 兑换与 S3.4 退款回退都要用它 */
export interface FifoDeduction {
  txnId: number;
  amount: number;
  expireAt: Date | null;
}

/** S3.3：积分过期清零（手动触发 / 定时任务共用）的入参 */
export interface PointsExpireOptions {
  operatorId?: number | null;
  operatorType?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  triggeredBy?: 'manual' | 'cron';
}

/** S3.3：积分过期清零结果 */
export interface PointsExpireResult {
  processed: number;
  expiredAmount: number;
  startedAt: Date;
  finishedAt: Date;
  skipped: boolean;
  message?: string;
}

/**
 * 积分账户 / 积分流水 / 消费录单送积分 / 人工调整（S3.1）
 *
 * ## 为什么积分账户要用乐观锁
 *
 * 积分是**金额类资产**：并发写冲突一旦处理错，就是「用户白得一笔」或「用户积分凭空消失」，
 * 比券的超发更难在事后对账（券有券码可追溯，积分只有数字）。所以：
 *
 * 1. **账户更新走版本号**：`UPDATE point_accounts SET ... WHERE userId=? AND version=?`，
 *    影响行数 0 说明有人抢先改了 → **整事务重跑**（最多 3 次），超过 → 409 `CONCURRENT_UPDATE`。
 *    刻意不用 `SELECT ... FOR UPDATE`：积分写入是多批次 + 账户多字段，行锁会拉长事务；
 *    乐观锁在「冲突不频繁」的真实场景下更快，且冲突是可观测的（重试次数 / 409 数量）。
 * 2. **批次扣减走条件更新**：`UPDATE point_transactions SET remainingAmount = remainingAmount - N
 *    WHERE id=? AND remainingAmount >= N`，影响行数 0 → 409 `BALANCE_NOT_ENOUGH`。
 *    这一步与账户更新在同一个事务里，不会出现「批次扣了、账户没扣」。
 * 3. **同一订单只送一次积分**：唯一索引 `(relatedOrderId, type)` 兜底，
 *    并发重复录单时其中一个请求撞 P2002 → 409 `ORDER_POINTS_ALREADY_EARNED` 且整事务回滚。
 *
 * ## FIFO 的口径
 *
 * 消耗按 `expireAt` 升序，先吃掉最快过期的批次（用户视角最公平，也减少平台负债）。
 * **过期批次不可用**：`expireAt <= now` 的批次即便 remainingAmount>0 也不参与扣减——
 * 这是 S3.2 那句「余额看着够、但能花的不够」的根源，错误码统一 `BALANCE_NOT_ENOUGH`。
 */
@Injectable()
export class PointService {
  private readonly logger = new Logger('Point');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- 账户查询

  /** 积分账户列表：平台全量；商家 / 店员只看「在自己体系内产生过积分流水」的用户 */
  async listAccounts(query: QueryPointAccountsDto, user: JwtPayload) {
    const scope = await this.scopeFilter(user);
    // 账户表本身没有商家字段，可见用户 = 在可见范围内产生过流水的人
    let visibleUserIds: number[] | null = null;
    if (Object.keys(scope).length > 0) {
      const rows = await this.prisma.pointTransaction.findMany({
        where: scope,
        distinct: ['userId'],
        select: { userId: true },
      });
      visibleUserIds = rows.map((r) => r.userId);
    }

    const userFilter: Prisma.UserWhereInput = query.keyword
      ? { OR: [{ nickname: { contains: query.keyword } }, { phone: { contains: query.keyword } }] }
      : {};

    const where: Prisma.PointAccountWhereInput = {
      ...(visibleUserIds ? { userId: { in: visibleUserIds } } : {}),
      ...(query.minBalance !== undefined ? { balance: { gte: query.minBalance } } : {}),
      ...(query.keyword ? { user: userFilter } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.pointAccount.findMany({
        where,
        orderBy: [{ balance: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { user: { select: { id: true, nickname: true, phone: true, status: true } } },
      }),
      this.prisma.pointAccount.count({ where }),
    ]);

    const now = new Date();
    const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 3600 * 1000);
    // 临期积分（30 天内过期且未消耗完的批次）——列表页要能筛出「该提醒用户了」的人
    const expiring = await this.prisma.pointTransaction.groupBy({
      by: ['userId'],
      where: {
        userId: { in: rows.map((r) => r.userId) },
        remainingAmount: { gt: 0 },
        expireAt: { gt: now, lte: soon },
      },
      _sum: { remainingAmount: true },
    });
    const expiringMap = new Map(expiring.map((e) => [e.userId, e._sum.remainingAmount ?? 0]));

    let list = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user?.nickname ?? null,
      userPhone: r.user?.phone ?? null,
      balance: r.balance,
      totalEarned: r.totalEarned,
      totalSpent: r.totalSpent,
      totalExpired: r.totalExpired,
      expiringSoon: expiringMap.get(r.userId) ?? 0,
      version: r.version,
      updatedAt: r.updatedAt,
    }));
    if (query.expiringSoon) list = list.filter((x) => x.expiringSoon > 0);

    return { list, total: query.expiringSoon ? list.length : total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * 积分账户详情：余额 + **批次明细**（未过期且未用完，按 expireAt 升序 = FIFO 视角）+ 临期汇总。
   * 把批次摊开给前端看，是为了让「余额够但花不掉」这种问题一眼可解释（S3.2 的错误码来源）。
   */
  async accountDetail(userId: number, user: JwtPayload) {
    await this.assertUserVisible(userId, user);

    const account = await this.prisma.pointAccount.findUnique({
      where: { userId },
      include: { user: { select: { id: true, nickname: true, phone: true, status: true } } },
    });
    if (!account) {
      throw BizException.notFound(ReasonCode.POINT_ACCOUNT_NOT_FOUND, `用户 #${userId} 还没有积分账户`);
    }

    const now = new Date();
    const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 3600 * 1000);
    const batches = await this.prisma.pointTransaction.findMany({
      where: { userId, remainingAmount: { gt: 0 } },
      orderBy: [{ expireAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        type: true,
        amount: true,
        remainingAmount: true,
        expireAt: true,
        merchantId: true,
        storeId: true,
        createdAt: true,
        remark: true,
      },
    });

    const merchantIds = [...new Set(batches.map((b) => b.merchantId).filter((v): v is number => !!v))];
    const merchants = merchantIds.length
      ? await this.prisma.merchant.findMany({ where: { id: { in: merchantIds } }, select: { id: true, name: true } })
      : [];
    const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));

    const alive = batches.filter((b) => !b.expireAt || b.expireAt > now);
    const expired = batches.filter((b) => b.expireAt && b.expireAt <= now);

    return {
      account: {
        id: account.id,
        userId: account.userId,
        userName: account.user?.nickname ?? null,
        userPhone: account.user?.phone ?? null,
        balance: account.balance,
        totalEarned: account.totalEarned,
        totalSpent: account.totalSpent,
        totalExpired: account.totalExpired,
        version: account.version,
        updatedAt: account.updatedAt,
      },
      summary: {
        // 能花的（未过期批次剩余之和）——与 balance 的差异就是「待过期任务清理的历史批次」
        available: alive.reduce((s, b) => s + b.remainingAmount, 0),
        expiringSoon: alive
          .filter((b) => b.expireAt && b.expireAt <= soon)
          .reduce((s, b) => s + b.remainingAmount, 0),
        expiredPending: expired.reduce((s, b) => s + b.remainingAmount, 0),
        batchCount: alive.length,
      },
      batches: batches.map((b) => ({
        id: b.id,
        type: b.type,
        amount: b.amount,
        remainingAmount: b.remainingAmount,
        expireAt: b.expireAt,
        // 已过期 / 未过期：前端据此标灰
        usable: !b.expireAt || b.expireAt > now,
        merchantId: b.merchantId,
        merchantName: b.merchantId ? merchantMap.get(b.merchantId) ?? null : null,
        storeId: b.storeId,
        createdAt: b.createdAt,
        remark: b.remark,
      })),
    };
  }

  // ---------------------------------------------------------------- 流水查询

  /** 积分流水：类型 / 用户 / 商家 / 门店 / 时间筛选，越权查别人 → 403 FORBIDDEN_SCOPE */
  async listTransactions(query: QueryPointTransactionsDto, user: JwtPayload) {
    const scope = await this.scopeFilter(user);
    const allowedMerchantIds = await this.visibleMerchantIds(user);
    if (query.merchantId && allowedMerchantIds && !allowedMerchantIds.includes(query.merchantId)) {
      throw BizException.forbidden(ReasonCode.FORBIDDEN_SCOPE, '无权查看该商家的积分流水');
    }
    if (query.storeId && user.userType === 'STORE' && query.storeId !== user.storeId) {
      throw BizException.forbidden(ReasonCode.FORBIDDEN_SCOPE, '无权查看该门店的积分流水');
    }
    if (query.userId) {
      await this.assertUserVisible(query.userId, user);
    }

    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) createdAt.lte = new Date(`${query.to}T23:59:59.999Z`);

    // 可见范围用 AND 包一层：避免业务筛选里的 OR 与可见范围的 OR 互相覆盖（S1.4 审计踩过的坑）
    const where: Prisma.PointTransactionWhereInput = {
      AND: [
        scope,
        {
          ...(query.userId ? { userId: query.userId } : {}),
          ...(query.type ? { type: query.type } : {}),
          ...(query.merchantId ? { merchantId: query.merchantId } : {}),
          ...(query.storeId ? { storeId: query.storeId } : {}),
          ...(query.from || query.to ? { createdAt } : {}),
        },
      ],
    };

    const [rows, total] = await Promise.all([
      this.prisma.pointTransaction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { user: { select: { id: true, nickname: true, phone: true } } },
      }),
      this.prisma.pointTransaction.count({ where }),
    ]);

    // point_transactions 只有 merchantId 标量（没有 merchant 关系），商家名单独查一次
    const merchantIds = [...new Set(rows.map((r) => r.merchantId).filter((v): v is number => !!v))];
    const merchants = merchantIds.length
      ? await this.prisma.merchant.findMany({ where: { id: { in: merchantIds } }, select: { id: true, name: true } })
      : [];
    const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));

    const operatorIds = [...new Set(rows.map((r) => r.operatorId).filter((v): v is number => !!v))];
    const operators = operatorIds.length
      ? await this.prisma.adminUser.findMany({
          where: { id: { in: operatorIds } },
          select: { id: true, realName: true, username: true },
        })
      : [];
    const operatorMap = new Map(operators.map((o) => [o.id, o.realName || o.username]));

    return {
      list: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: r.user?.nickname ?? null,
        userPhone: r.user?.phone ?? null,
        type: r.type,
        amount: r.amount,
        remainingAmount: r.remainingAmount,
        balanceAfter: r.balanceAfter,
        expireAt: r.expireAt,
        merchantId: r.merchantId,
        merchantName: r.merchantId ? merchantMap.get(r.merchantId) ?? null : null,
        storeId: r.storeId,
        relatedOrderId: r.relatedOrderId,
        relatedCouponInstanceId: r.relatedCouponInstanceId,
        sourceTransactionId: r.sourceTransactionId,
        originBatchId: r.originBatchId,
        operatorId: r.operatorId,
        operatorName: r.operatorId ? operatorMap.get(r.operatorId) ?? null : null,
        remark: r.remark,
        createdAt: r.createdAt,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // ---------------------------------------------------------------- 积分过期清零（S3.3）

  /**
   * 积分过期清零（定时任务 + 手动触发共用）。
   *
   * 扫描 `point_transactions` 中 `type=EARN AND remainingAmount>0 AND expireAt<NOW()` 的批次，
   * 逐批（每批最多 500 条，避免大事务锁表）在**单事务内**对其做：
   *  - 条件更新剩余为 0（`WHERE id=? AND remainingAmount=?`，并发/重复只会有 1 个成功 → 天然幂等）；
   *  - 写一条 EXPIRE 流水（amount=-remainingAmount，sourceTransactionId 指回原批次）；
   *  - 账户余额扣减 + totalExpired 累加（乐观锁 version，冲突重试）。
   *
   * 幂等：同一批次第二次进来时 remainingAmount 已为 0，扫描即排除；并发触发由内存 `running` 互斥，
   * 唯一索引 `(userId, sourceTransactionId, type)` 兜底（同一批次只能有一条 EXPIRE）。
   */
  private running = false;

  async expirePoints(opts: PointsExpireOptions = {}): Promise<PointsExpireResult> {
    if (this.running) {
      return {
        processed: 0,
        expiredAmount: 0,
        startedAt: new Date(),
        finishedAt: new Date(),
        skipped: true,
        message: '已有过期清零任务在执行，本次跳过',
      };
    }
    this.running = true;
    const startedAt = new Date();
    let processed = 0;
    let expiredAmount = 0;
    try {
      const now = new Date();
      // 循环分批扫描，每批最多 500 条，处理完再取下一页，直到没有过期批次
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const batch = await this.prisma.pointTransaction.findMany({
          where: { type: PointTxnType.EARN, remainingAmount: { gt: 0 }, expireAt: { lt: now } },
          select: { id: true, userId: true, merchantId: true, storeId: true, remainingAmount: true },
          orderBy: { expireAt: 'asc' },
          take: 500,
        });
        if (batch.length === 0) break;

        let done: { count: number; amount: number } | undefined;
        let lastErr: unknown = null;
        for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
          try {
            done = await this.expireBatch(batch, opts);
            break;
          } catch (e) {
            lastErr = e;
            if (e instanceof ConcurrentSignal || isTransientLockError(e)) {
              if (attempt === MAX_RETRY) {
                this.logger.warn(`积分过期批次处理并发冲突重试耗尽，跳过该批（${batch.length} 条）`);
                break;
              }
              await sleep(20 * attempt + Math.floor(Math.random() * 20));
              continue;
            }
            throw e;
          }
        }
        if (lastErr && !(lastErr instanceof ConcurrentSignal) && !isTransientLockError(lastErr)) throw lastErr;
        processed += done?.count ?? 0;
        expiredAmount += done?.amount ?? 0;
      }
    } finally {
      this.running = false;
    }

    await this.audit.record({
      operatorId: opts.operatorId ?? null,
      operatorType: opts.operatorType ?? null,
      module: 'point',
      action: ACTION.expire,
      targetType: 'point_account',
      before: null,
      after: {
        triggeredBy: opts.triggeredBy ?? 'manual',
        processed,
        expiredAmount,
        startedAt,
        finishedAt: new Date(),
      },
      ip: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
    });

    return { processed, expiredAmount, startedAt, finishedAt: new Date(), skipped: false };
  }

  /**
   * 单批（≤500 条 EARN）过期清零，整批一个事务；按 userId 聚合账户扣减，减少账户行锁竞争。
   * 返回本批实际处理的批次数与过期总积分。
   */
  private async expireBatch(
    batch: Array<{ id: number; userId: number; merchantId: number | null; storeId: number | null; remainingAmount: number }>,
    opts: PointsExpireOptions,
  ): Promise<{ count: number; amount: number }> {
    return this.prisma.$transaction(async (tx) => {
      const byUser = new Map<number, typeof batch>();
      for (const r of batch) {
        const arr = byUser.get(r.userId);
        if (arr) arr.push(r);
        else byUser.set(r.userId, [r]);
      }

      let count = 0;
      let amount = 0;
      const expireRows: Array<Prisma.PointTransactionCreateManyInput> = [];
      for (const [userId, rows] of byUser) {
        const acct = await tx.pointAccount.findUnique({ where: { userId } });
        if (!acct) continue;
        let curBalance = acct.balance;
        let userExpired = 0;
        for (const r of rows) {
          // 条件更新：仅当剩余仍是扫描时的值才置 0 —— 并发/重复处理只会有 1 个成功，天然幂等
          const upd = await tx.pointTransaction.updateMany({
            where: { id: r.id, remainingAmount: r.remainingAmount },
            data: { remainingAmount: 0 },
          });
          if (upd.count === 0) continue; // 已被别的触发清零
          curBalance -= r.remainingAmount;
          userExpired += r.remainingAmount;
          expireRows.push({
            userId,
            accountId: acct.id,
            type: PointTxnType.EXPIRE,
            amount: -r.remainingAmount,
            remainingAmount: 0,
            balanceAfter: curBalance,
            expireAt: null,
            sourceTransactionId: r.id,
            merchantId: r.merchantId,
            storeId: r.storeId,
            operatorId: opts.operatorId ?? null,
            remark: `批次#${r.id} 过期清零（${r.remainingAmount} 分）`,
            createdAt: new Date(),
          });
          count++;
        }
        if (userExpired > 0) {
          const affected = await tx.$executeRaw(
            Prisma.sql`UPDATE point_accounts SET balance = balance - ${userExpired}, totalExpired = totalExpired + ${userExpired}, version = version + 1 WHERE userId = ${userId} AND version = ${acct.version}`,
          );
          if (affected === 0) throw new ConcurrentSignal();
          amount += userExpired;
        }
      }
      // 批量插入 EXPIRE 流水（比逐条 create 少 N-1 次往返，10000 条场景从 ~27s 降到 ~10s）
      if (expireRows.length) await tx.pointTransaction.createMany({ data: expireRows });
      return { count, amount };
    });
  }

  // ---------------------------------------------------------------- 消费录单送积分

  /**
   * 消费录单送积分（内部接口，S3.4 订单模块复用同一实现）
   *
   * 流程：解析归属（商家 / 门店）→ 取积分规则（商家级优先，其次平台级）→ 算积分 →
   * 事务内写 EARN 批次 + 账户版本更新（乐观锁，冲突重试 3 次）→ 审计。
   */
  async earn(dto: EarnPointsDto, user: JwtPayload, ip?: string, ua?: string) {
    const { merchantId, storeId } = await this.resolveMerchantStore(dto, user);

    const target = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, nickname: true, phone: true, status: true },
    });
    if (!target) {
      throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, `用户 #${dto.userId} 不存在`);
    }

    const rule = await this.resolveRule(merchantId);
    const order = await this.resolveOrder(dto);
    // 消费送积分**必须挂订单**：幂等唯一索引是 (relatedOrderId, type)，
    // 没有订单就没有幂等键，重复录单会静默翻倍——宁可拒绝，也不留「双倍积分」的口子。
    // 纯人工调整请走 POST /points/adjust。
    if (!order) {
      throw BizException.badRequest(
        ReasonCode.ORDER_ID_REQUIRED,
        '消费录单送积分必须带 orderId 或 orderNo（一单只送一次积分靠它做幂等键）；人工调整请走 POST /points/adjust',
      );
    }

    const amount = Number(dto.amount);
    const minAmount = Number(rule.minAmount);
    // 未达起送金额：这是**业务规则**不是错误——不写流水、不报错，明确返回「本次不送分」
    if (amount < minAmount) {
      return {
        earned: false,
        points: 0,
        reasonCode: 'BELOW_MIN_AMOUNT',
        message: `消费 ${amount} 元未达起送金额 ${minAmount} 元，本次不送积分`,
        rule: { merchantId: rule.merchantId, earnRatio: Number(rule.earnRatio), minAmount },
      };
    }
    const points = Math.floor(amount * Number(rule.earnRatio));
    if (points <= 0) {
      return {
        earned: false,
        points: 0,
        reasonCode: 'POINTS_ZERO',
        message: `按规则折算后积分为 0（金额 ${amount} × 比例 ${Number(rule.earnRatio)}）`,
        rule: { merchantId: rule.merchantId, earnRatio: Number(rule.earnRatio), minAmount },
      };
    }

    const now = new Date();
    const expireAt = this.computeExpireAt(rule, now);

    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          // 幂等：同一订单只送一次。先查（友好报错）+ 唯一索引兜底（并发时兜住）
          if (order) {
            const exist = await tx.pointTransaction.findFirst({
              where: { relatedOrderId: order.id, type: PointTxnType.EARN },
              select: { id: true, amount: true, createdAt: true },
            });
            if (exist) {
              throw BizException.conflict(
                ReasonCode.ORDER_POINTS_ALREADY_EARNED,
                `订单 #${order.id}（${order.orderNo}）已送过 ${exist.amount} 积分，不能重复送`,
              );
            }
          }

          const account = await this.ensureAccount(tx, dto.userId);
          const balanceAfter = account.balance + points;

          const txn = await tx.pointTransaction.create({
            data: {
              userId: dto.userId,
              accountId: account.id,
              type: PointTxnType.EARN,
              amount: points,
              // 新批次的剩余量 = 本次获得量，后续被 FIFO 消耗
              remainingAmount: points,
              balanceAfter,
              expireAt,
              relatedOrderId: order?.id ?? null,
              merchantId,
              storeId: storeId ?? null,
              operatorId: user.sub,
              remark: dto.remark ?? '消费送积分',
            },
          });

          // 乐观锁：version 对不上说明有人抢先改了 → 抛内部信号整事务重跑
          const affected = await tx.$executeRaw(
            Prisma.sql`UPDATE point_accounts SET balance = balance + ${points}, totalEarned = totalEarned + ${points}, version = version + 1 WHERE userId = ${dto.userId} AND version = ${account.version}`,
          );
          if (affected === 0) throw new ConcurrentSignal();

          await this.audit.record(
            {
              operatorId: user.sub,
              operatorType: user.userType,
              module: 'point',
              action: ACTION.earn,
              targetType: 'point_account',
              targetId: account.id,
              before: { userId: dto.userId, balance: account.balance, version: account.version },
              after: { balance: balanceAfter, points, expireAt, orderId: order?.id ?? null, transactionId: txn.id },
              ip,
              userAgent: ua,
            },
            tx,
          );

          return {
            earned: true,
            points,
            transactionId: txn.id,
            expireAt,
            balance: balanceAfter,
            accountId: account.id,
            rule: { merchantId: rule.merchantId, earnRatio: Number(rule.earnRatio), minAmount },
          };
        });
      } catch (e) {
        lastErr = e;
        // 乐观锁冲突 **与** MySQL 瞬时死锁（1213）/ 锁等待超时（1205）都重试：
        // 两个并发事务对同一用户的批次行 + 账户行加锁顺序交错时会触发死锁，这是可重试的瞬时错误，
        // 不重试就会把「用户正常录单」变成 500 —— 比冲突本身严重得多。
        if (e instanceof ConcurrentSignal || isTransientLockError(e)) {
          if (attempt === MAX_RETRY) break;
          await sleep(20 * attempt + Math.floor(Math.random() * 20));
          continue;
        }
        if (isEarnOrderUniqueViolation(e)) {
          // **精确**命中「同一订单只送一次」的唯一索引 uniq_point_earn_order(relatedOrderId, type)
          throw BizException.conflict(
            ReasonCode.ORDER_POINTS_ALREADY_EARNED,
            `订单 #${order?.id ?? '-'}（${order?.orderNo ?? '-'}）已送过积分，不能重复送`,
          );
        }
        if (isUniqueViolation(e)) {
          // 其它唯一键冲突（可能是并发创建的瞬时冲突）：重试，仍失败抛原始错误，避免误报为业务冲突
          if (attempt === MAX_RETRY) throw e;
          await sleep(20 * attempt + Math.floor(Math.random() * 20));
          continue;
        }
        throw e;
      }
    }
    throw BizException.conflict(
      ReasonCode.CONCURRENT_UPDATE,
      `积分账户并发更新冲突，已重试 ${MAX_RETRY} 次仍未成功，请稍后重试`,
    );
  }

  // ---------------------------------------------------------------- 人工调整

  /**
   * 人工调整积分：正增负减，必填原因（≥5 字符，DTO 校验），写 ADJUST 流水 + 审计。
   * 负向调整**走 FIFO 扣减**（与兑换一致），且过期批次不可用——避免「调账把过期积分盘活」。
   */
  async adjust(dto: AdjustPointsDto, user: JwtPayload, ip?: string, ua?: string) {
    if (dto.amount === 0) {
      throw BizException.badRequest(ReasonCode.INVALID_ADJUST_AMOUNT, '调整积分不能为 0');
    }
    // 注意这里用的是「可写」口径而不是「可读」口径：
    // 人工调整常常是给**还没有任何积分流水的新用户**补分，若套用读可见性（有流水才可见）会被 403 挡掉，
    // 逼着运营先想办法造一条流水——这是把查询口径错位用到了写操作上。
    await this.assertWritableUser(dto.userId, user);
    const target = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, nickname: true, phone: true },
    });
    if (!target) {
      throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, `用户 #${dto.userId} 不存在`);
    }

    const isAdd = dto.amount > 0;
    const points = Math.abs(dto.amount);
    const now = new Date();

    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const account = await this.ensureAccount(tx, dto.userId);

          let expireAt: Date | null = null;
          let deductions: FifoDeduction[] = [];
          if (isAdd) {
            if (dto.expireAt) {
              expireAt = new Date(dto.expireAt);
            } else {
              const rule = await this.resolveRule(null);
              expireAt = this.computeExpireAt(rule, now);
            }
          } else {
            // 扣减：按 FIFO 吃掉最快过期的批次，够不够由批次说话（不看账户余额）
            deductions = await this.consumeFifo(tx, dto.userId, points, now);
          }

          const balanceAfter = isAdd ? account.balance + points : account.balance - points;
          if (!isAdd && balanceAfter < 0) {
            throw BizException.conflict(
              ReasonCode.BALANCE_NOT_ENOUGH,
              `可用积分不足：需扣减 ${points}，当前余额 ${account.balance}`,
            );
          }

          const txn = await tx.pointTransaction.create({
            data: {
              userId: dto.userId,
              accountId: account.id,
              type: PointTxnType.ADJUST,
              amount: isAdd ? points : -points,
              // 正向调整是「新批次」可被后续 FIFO 消耗；负向调整本身不是批次，remaining=0
              remainingAmount: isAdd ? points : 0,
              balanceAfter,
              expireAt,
              operatorId: user.sub,
              remark: dto.reason,
            },
          });

          const affected = isAdd
            ? await tx.$executeRaw(
                Prisma.sql`UPDATE point_accounts SET balance = balance + ${points}, totalEarned = totalEarned + ${points}, version = version + 1 WHERE userId = ${dto.userId} AND version = ${account.version}`,
              )
            : await tx.$executeRaw(
                Prisma.sql`UPDATE point_accounts SET balance = balance - ${points}, totalSpent = totalSpent + ${points}, version = version + 1 WHERE userId = ${dto.userId} AND version = ${account.version}`,
              );
          if (affected === 0) throw new ConcurrentSignal();

          await this.audit.record(
            {
              operatorId: user.sub,
              operatorType: user.userType,
              module: 'point',
              action: ACTION.adjust,
              targetType: 'point_account',
              targetId: account.id,
              before: { userId: dto.userId, balance: account.balance, version: account.version },
              after: { balance: balanceAfter, adjust: dto.amount, reason: dto.reason, transactionId: txn.id, deductions },
              ip,
              userAgent: ua,
            },
            tx,
          );

          return {
            adjusted: true,
            amount: isAdd ? points : -points,
            transactionId: txn.id,
            expireAt,
            balance: balanceAfter,
            deductions,
          };
        });
      } catch (e) {
        lastErr = e;
        if (e instanceof ConcurrentSignal || isTransientLockError(e)) {
          if (attempt === MAX_RETRY) break;
          await sleep(20 * attempt + Math.floor(Math.random() * 20));
          continue;
        }
        throw e;
      }
    }
    throw BizException.conflict(
      ReasonCode.CONCURRENT_UPDATE,
      `积分账户并发更新冲突（含数据库瞬时死锁），已重试 ${MAX_RETRY} 次仍未成功，请稍后重试`,
    );
  }

  // ---------------------------------------------------------------- 积分兑换（S3.2）

  /**
   * 积分兑换代金券
   *
   * 严格按 9 步顺序执行，**任一步失败整事务回滚**（用例 9 用注入触发器验证）：
   * ① 幂等键 → ② 模板校验（存在/上架/库存/限领）→ ③ 可用积分校验 → ④ FIFO 扣减（含 SPEND 流水）→
   * ⑤ 券码分配（FOR UPDATE + 条件更新）→ ⑥ 生成券实例 → ⑦ 账户乐观锁扣减 →
   * ⑧ 模板 issuedCount 条件更新 → ⑨ 兑换记录 + 审计。
   *
   * 幂等：同一 `(userId, requestId)` 已存在 → **返回上次结果**（200 + `idempotent:true`），
   * 不是 409 —— 幂等语义下重复提交应当看到同一个结果，而不是「被拒绝」。
   */
  async exchange(dto: ExchangePointsDto, user: JwtPayload, ip?: string, ua?: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, nickname: true, phone: true },
    });
    if (!target) {
      throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, `用户 #${dto.userId} 不存在`);
    }

    // ① 幂等键命中 → 直接回上次结果（不写任何数据）
    const exist = await this.prisma.exchangeRecord.findUnique({
      where: { userId_requestId: { userId: dto.userId, requestId: dto.requestId } },
      include: { couponInstance: { select: { id: true, code: true, expireAt: true } } },
    });
    if (exist) {
      return {
        idempotent: true,
        exchangeId: exist.id,
        couponInstanceId: exist.couponInstanceId,
        code: exist.couponInstance?.code ?? null,
        expireAt: exist.couponInstance?.expireAt ?? null,
        pointsCost: exist.pointsCost,
        templateId: exist.templateId,
        createdAt: exist.createdAt,
      };
    }

    // ② 模板校验
    const template = await this.prisma.couponTemplate.findUnique({ where: { id: dto.templateId } });
    if (!template) {
      throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, `券模板 #${dto.templateId} 不存在`);
    }
    if (template.status !== CouponTemplateStatus.PUBLISHED) {
      throw BizException.conflict(
        ReasonCode.TEMPLATE_NOT_AVAILABLE,
        `券模板「${template.name}」当前状态为 ${template.status}，只有已上架的模板可兑换`,
      );
    }
    const pointsCost = template.pointsCost;
    if (pointsCost <= 0) {
      throw BizException.badRequest(
        ReasonCode.TEMPLATE_NOT_EXCHANGEABLE,
        `券模板「${template.name}」未设置兑换所需积分（pointsCost=${pointsCost}），不支持积分兑换`,
      );
    }
    if (template.totalStock - template.issuedCount < 1) {
      throw BizException.conflict(
        ReasonCode.STOCK_EXHAUSTED,
        `券模板「${template.name}」库存不足：本次需 1 张，剩余 ${Math.max(template.totalStock - template.issuedCount, 0)} 张`,
      );
    }
    const owned = await this.prisma.couponInstance.count({
      where: { userId: dto.userId, templateId: dto.templateId },
    });
    if (owned >= template.perUserLimit) {
      throw BizException.conflict(
        ReasonCode.PER_USER_LIMIT_EXCEEDED,
        `该用户已兑换「${template.name}」${owned} 张，达到限领 ${template.perUserLimit} 张`,
      );
    }

    // ③ 可用积分（未过期批次之和）预检：先把「余额够但花不掉」说清楚，再进事务
    const now = new Date();
    const availableRows = await this.prisma.pointTransaction.findMany({
      where: {
        userId: dto.userId,
        remainingAmount: { gt: 0 },
        OR: [{ expireAt: null }, { expireAt: { gt: now } }],
      },
      select: { remainingAmount: true },
    });
    const available = availableRows.reduce((s, r) => s + r.remainingAmount, 0);
    if (available < pointsCost) {
      throw BizException.conflict(
        ReasonCode.BALANCE_NOT_ENOUGH,
        `可用积分不足：需 ${pointsCost}，未过期批次可用 ${available}（过期积分不可用于兑换）`,
      );
    }

    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          // ⑤ 券码：FOR UPDATE 锁行 + 条件更新（并发下只有一个请求能拿到同一个码）
          const codes = await tx.$queryRaw<Array<{ id: bigint | number; code: string }>>(
            Prisma.sql`SELECT id, code FROM coupon_codes WHERE templateId = ${dto.templateId} AND status = 'UNISSUED' ORDER BY id ASC LIMIT 1 FOR UPDATE`,
          );
          if (codes.length === 0) {
            throw BizException.conflict(
              ReasonCode.CODE_POOL_EXHAUSTED,
              `券模板「${template.name}」券码池已耗尽，请先预生成券码`,
            );
          }
          const codeId = Number(codes[0].id);
          const codeStr = codes[0].code;
          const codeAffected = await tx.$executeRaw(
            Prisma.sql`UPDATE coupon_codes SET status = 'ISSUED' WHERE id = ${codeId} AND status = 'UNISSUED'`,
          );
          if (codeAffected === 0) {
            throw BizException.conflict(
              ReasonCode.CODE_POOL_EXHAUSTED,
              `券码 #${codeId} 已被占用（并发兑换），请重试`,
            );
          }

          // ④ FIFO 扣减积分（内部会再校验一次可用量，并逐笔条件更新）
          const deductions = await this.consumeFifo(tx, dto.userId, pointsCost, now);

          const account = await this.ensureAccount(tx, dto.userId);
          const balanceAfter = account.balance - pointsCost;
          if (balanceAfter < 0) {
            throw BizException.conflict(
              ReasonCode.BALANCE_NOT_ENOUGH,
              `可用积分不足：需 ${pointsCost}，当前余额 ${account.balance}`,
            );
          }

          // ⑥ 生成券实例：积分兑换来的券**归属主体商家**（券是主体的资产，只是发给用户）
          const expireAt = this.computeCouponExpireAt(template, now);
          const instance = await tx.couponInstance.create({
            data: {
              userId: dto.userId,
              templateId: dto.templateId,
              code: codeStr,
              issuerMerchantId: template.ownerMerchantId,
              source: CouponSource.EXCHANGE,
              pointsCost,
              expireAt,
            },
          });
          // 券码反向绑定实例（coupon_codes.instanceId 唯一，并发下不会被绑两次）
          await tx.$executeRaw(
            Prisma.sql`UPDATE coupon_codes SET instanceId = ${instance.id} WHERE id = ${codeId} AND instanceId IS NULL`,
          );

          // ④-b SPEND 流水：**每个被扣批次一条**（而不是汇总成一条）。
          // 这样 S3.4 退款回退才能按「方案 A：退回原批次、保留原 expireAt」精确还原
          // ——汇总成一条就丢失了「这笔钱是从哪批扣的」，只能粗略地当成新批次退回。
          let running = account.balance;
          for (const d of deductions) {
            running -= d.amount;
            await tx.pointTransaction.create({
              data: {
                userId: dto.userId,
                accountId: account.id,
                type: PointTxnType.SPEND,
                amount: -d.amount,
                remainingAmount: 0,
                balanceAfter: running,
                merchantId: template.ownerMerchantId,
                operatorId: user.sub,
                relatedCouponInstanceId: instance.id,
                // S4 收口：记录「这笔扣减来自哪个 EARN 批次」改用 originBatchId（不再占用 sourceTransactionId，
                // 后者仅留给 EXPIRE 的幂等键），退款回退据此按方案 A 精确还原到原批次
                originBatchId: d.txnId,
                remark: dto.remark ?? `积分兑换「${template.name}」（批次 #${d.txnId} 扣 ${d.amount}）`,
              },
            });
          }

          // ⑦ 账户乐观锁扣减
          const accAffected = await tx.$executeRaw(
            Prisma.sql`UPDATE point_accounts SET balance = balance - ${pointsCost}, totalSpent = totalSpent + ${pointsCost}, version = version + 1 WHERE userId = ${dto.userId} AND version = ${account.version}`,
          );
          if (accAffected === 0) throw new ConcurrentSignal();

          // ⑧ 模板 issuedCount 条件更新（放在最后：它是「库存」这道闸门的最终落点，失败则前面全部回滚）
          const stockAffected = await tx.$executeRaw(
            Prisma.sql`UPDATE coupon_templates SET issuedCount = issuedCount + 1, updatedAt = NOW() WHERE id = ${dto.templateId} AND totalStock - issuedCount >= 1`,
          );
          if (stockAffected === 0) {
            throw BizException.conflict(
              ReasonCode.STOCK_EXHAUSTED,
              `券模板「${template.name}」库存不足（并发兑换已抢完），请稍后再试`,
            );
          }

          // ⑨ 兑换记录（幂等键落库）+ 审计
          const record = await tx.exchangeRecord.create({
            data: {
              userId: dto.userId,
              templateId: dto.templateId,
              couponInstanceId: instance.id,
              pointsCost,
              requestId: dto.requestId,
              channel: dto.channel ?? 'H5',
              merchantId: template.ownerMerchantId,
              operatorId: user.sub,
              remark: dto.remark ?? null,
            },
          });

          await this.audit.record(
            {
              operatorId: user.sub,
              operatorType: user.userType,
              module: 'point',
              action: ACTION.exchange,
              targetType: 'exchange_record',
              targetId: record.id,
              before: {
                userId: dto.userId,
                balance: account.balance,
                version: account.version,
                available,
              },
              after: {
                balance: balanceAfter,
                pointsCost,
                couponInstanceId: instance.id,
                code: codeStr,
                deductions,
                requestId: dto.requestId,
              },
              ip,
              userAgent: ua,
            },
            tx,
          );

          return {
            idempotent: false,
            exchangeId: record.id,
            couponInstanceId: instance.id,
            code: codeStr,
            expireAt,
            pointsCost,
            balance: balanceAfter,
            deductions,
          };
        });
      } catch (e) {
        lastErr = e;
        // 幂等键撞车（并发重复提交）：返回上次结果，而不是报错
        if (isUniqueViolation(e)) {
          const prev = await this.prisma.exchangeRecord.findUnique({
            where: { userId_requestId: { userId: dto.userId, requestId: dto.requestId } },
            include: { couponInstance: { select: { id: true, code: true, expireAt: true } } },
          });
          if (prev) {
            return {
              idempotent: true,
              exchangeId: prev.id,
              couponInstanceId: prev.couponInstanceId,
              code: prev.couponInstance?.code ?? null,
              expireAt: prev.couponInstance?.expireAt ?? null,
              pointsCost: prev.pointsCost,
              templateId: prev.templateId,
              createdAt: prev.createdAt,
            };
          }
        }
        if (e instanceof ConcurrentSignal || isTransientLockError(e)) {
          if (attempt === MAX_RETRY) break;
          await sleep(20 * attempt + Math.floor(Math.random() * 20));
          continue;
        }
        throw e;
      }
    }
    throw BizException.conflict(
      ReasonCode.CONCURRENT_UPDATE,
      `积分兑换并发冲突（含数据库瞬时死锁），已重试 ${MAX_RETRY} 次仍未成功，请稍后重试`,
    );
  }

  /** 兑换记录（用户视角为 /points/exchange-records?userId=自己） */
  async listExchangeRecords(query: QueryExchangeRecordsDto, user: JwtPayload) {
    if (query.userId) {
      await this.assertUserVisible(query.userId, user);
    }
    const merchantIds = await this.visibleMerchantIds(user);
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) createdAt.lte = new Date(`${query.to}T23:59:59.999Z`);

    const where: Prisma.ExchangeRecordWhereInput = {
      AND: [
        // 平台全量；其余按「券归属商家」收敛（无归属记录仅主体可见，与流水同口径）
        user.userType === 'PLATFORM'
          ? {}
          : { OR: [{ merchantId: { in: merchantIds ?? [] } }, ...(merchantIds && merchantIds.includes(user.merchantId ?? 0) ? [{ merchantId: null }] : [])] },
        {
          ...(query.userId ? { userId: query.userId } : {}),
          ...(query.templateId ? { templateId: query.templateId } : {}),
          ...(query.from || query.to ? { createdAt } : {}),
        },
      ],
    };

    const [rows, total] = await Promise.all([
      this.prisma.exchangeRecord.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          user: { select: { id: true, nickname: true, phone: true } },
          template: { select: { id: true, name: true, faceValue: true } },
          couponInstance: { select: { id: true, code: true, status: true, expireAt: true } },
        },
      }),
      this.prisma.exchangeRecord.count({ where }),
    ]);

    return {
      list: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: r.user?.nickname ?? null,
        userPhone: r.user?.phone ?? null,
        templateId: r.templateId,
        templateName: r.template?.name ?? null,
        faceValue: r.template ? Number(r.template.faceValue) : null,
        couponInstanceId: r.couponInstanceId,
        code: r.couponInstance?.code ?? null,
        couponStatus: r.couponInstance?.status ?? null,
        couponExpireAt: r.couponInstance?.expireAt ?? null,
        pointsCost: r.pointsCost,
        requestId: r.requestId,
        channel: r.channel,
        operatorId: r.operatorId,
        remark: r.remark,
        createdAt: r.createdAt,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // ---------------------------------------------------------------- 积分规则

  /** 规则列表：平台看全部；商家看「自己 + 平台默认」 */
  async listRules(user: JwtPayload) {
    const where: Prisma.PointRuleWhereInput =
      user.userType === 'PLATFORM'
        ? {}
        : { OR: [{ merchantId: user.merchantId ?? 0 }, { merchantId: 0 }] };
    const rows = await this.prisma.pointRule.findMany({ where, orderBy: [{ merchantId: 'asc' }, { id: 'asc' }] });
    return {
      list: rows.map((r) => ({
        id: r.id,
        merchantId: r.merchantId,
        // merchantId=0 就是平台级默认规则，商家没有自己的规则时回落到这里
        level: r.merchantId === 0 ? 'PLATFORM' : 'MERCHANT',
        earnRatio: Number(r.earnRatio),
        minAmount: Number(r.minAmount),
        pointsValidMonths: r.pointsValidMonths,
        expireMode: r.expireMode,
        status: r.status,
        effectiveAt: r.effectiveAt,
        updatedAt: r.updatedAt,
      })),
    };
  }

  /** 规则编辑：写审计（谁改的、改前改后）。改平台规则需要平台管理员。 */
  async updateRule(id: number, dto: UpdatePointRuleDto, user: JwtPayload, ip?: string, ua?: string) {
    const rule = await this.prisma.pointRule.findUnique({ where: { id } });
    if (!rule) {
      throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, `积分规则 #${id} 不存在`);
    }
    if (user.userType !== 'PLATFORM' && rule.merchantId !== user.merchantId) {
      throw BizException.forbidden(ReasonCode.FORBIDDEN_SCOPE, '只能修改本商家的积分规则');
    }

    const before = {
      earnRatio: Number(rule.earnRatio),
      minAmount: Number(rule.minAmount),
      pointsValidMonths: rule.pointsValidMonths,
      expireMode: rule.expireMode,
      status: rule.status,
    };
    try {
      const updated = await this.prisma.pointRule.update({
        where: { id },
        data: {
          ...(dto.earnRatio !== undefined ? { earnRatio: dto.earnRatio } : {}),
          ...(dto.minAmount !== undefined ? { minAmount: dto.minAmount } : {}),
          ...(dto.pointsValidMonths !== undefined ? { pointsValidMonths: dto.pointsValidMonths } : {}),
          ...(dto.expireMode !== undefined ? { expireMode: dto.expireMode as ExpireMode } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });
      await this.audit.record({
        operatorId: user.sub,
        operatorType: user.userType,
        module: 'point',
        action: ACTION.ruleUpdate,
        targetType: 'point_rule',
        targetId: id,
        before,
        after: {
          earnRatio: Number(updated.earnRatio),
          minAmount: Number(updated.minAmount),
          pointsValidMonths: updated.pointsValidMonths,
          expireMode: updated.expireMode,
          status: updated.status,
        },
        ip,
        userAgent: ua,
      });
      return { rule: { id: updated.id, merchantId: updated.merchantId, ...{
        earnRatio: Number(updated.earnRatio),
        minAmount: Number(updated.minAmount),
        pointsValidMonths: updated.pointsValidMonths,
        expireMode: updated.expireMode,
        status: updated.status,
      } } };
    } catch (e) {
      // 同一商家只能有一条生效规则（唯一约束 (merchantId, status)）；**精确匹配**该索引
      if (isPointRuleUniqueViolation(e)) {
        throw BizException.conflict(
          ReasonCode.POINT_RULE_ALREADY_ACTIVE,
          `商家 #${rule.merchantId} 已有一条生效中的积分规则，请先停用再启用`,
        );
      }
      throw e;
    }
  }

  // ---------------------------------------------------------------- FIFO（S3.2 兑换复用）

  /**
   * FIFO 扣减积分：**必须在事务内调用**。
   *
   * - 只挑「未过期（expireAt > now）且 remainingAmount > 0」的批次，按 `expireAt` 升序吃；
   * - 每笔都用条件更新 `WHERE remainingAmount >= take`，并发抢扣时影响行数 0 → 409 `BALANCE_NOT_ENOUGH`；
   * - 返回逐笔扣减明细，供兑换 / 退款回退（S3.4 方案 A：退回原批次，保留原 expireAt）。
   */
  async consumeFifo(
    tx: Prisma.TransactionClient,
    userId: number,
    points: number,
    now: Date,
  ): Promise<FifoDeduction[]> {
    // $queryRaw 里的 UnsignedInt 主键在 MySQL 侧是 BIGINT UNSIGNED，Prisma 会返回 BigInt，
    // 直接进响应会在 JSON 序列化时炸「Do not know how to serialize a BigInt」——这里一律转 Number。
    const raw = await tx.$queryRaw<Array<{ id: bigint | number; remainingAmount: number; expireAt: Date | null }>>(
      Prisma.sql`
        SELECT id, remainingAmount, expireAt
        FROM point_transactions
        WHERE userId = ${userId}
          AND type IN ('EARN', 'ADJUST', 'REFUND')
          AND remainingAmount > 0
          AND (expireAt IS NULL OR expireAt > ${now})
        ORDER BY (expireAt IS NULL), expireAt ASC, id ASC
        FOR UPDATE`,
    );
    const batches = raw.map((b) => ({
      id: Number(b.id),
      remainingAmount: Number(b.remainingAmount),
      expireAt: b.expireAt,
    }));

    const available = batches.reduce((s, b) => s + b.remainingAmount, 0);
    if (available < points) {
      throw BizException.conflict(
        ReasonCode.BALANCE_NOT_ENOUGH,
        `可用积分不足：需 ${points}，未过期批次可用 ${available}（过期积分不可用于扣减）`,
      );
    }

    const deductions: FifoDeduction[] = [];
    let need = points;
    for (const b of batches) {
      if (need <= 0) break;
      const take = Math.min(b.remainingAmount, need);
      const affected = await tx.$executeRaw(
        Prisma.sql`UPDATE point_transactions SET remainingAmount = remainingAmount - ${take} WHERE id = ${b.id} AND remainingAmount >= ${take}`,
      );
      if (affected === 0) {
        // 并发下这一批被别人抢先扣完了：整笔兑换失败，不留下「半扣」状态
        throw BizException.conflict(ReasonCode.BALANCE_NOT_ENOUGH, '积分批次并发扣减冲突，请重试');
      }
      deductions.push({ txnId: b.id, amount: take, expireAt: b.expireAt });
      need -= take;
    }
    if (need > 0) {
      throw BizException.conflict(
        ReasonCode.BALANCE_NOT_ENOUGH,
        `可用积分不足：还差 ${need} 分（FIFO 扣减中途发现批次不足）`,
      );
    }
    return deductions;
  }

  // ---------------------------------------------------------------- 退款回退 / 冲正（S3.4）

  /**
   * S3.4 方案 A：把某张积分兑换券消耗的积分**退回原 EARN 批次**（保留原 expireAt）。
   * 在调用方的事务内执行；账户乐观锁冲突抛 {@link ConcurrentSignal}（调用方整事务重试）。
   *
   * 关键点：
   *  - 兑换时每条 SPEND 都记了 `sourceTransactionId`（指向被扣的 EARN 批次），
   *    退款据此**精确还原**到原批次（而不是笼统地当成新批次退回）；
   *  - 只恢复原批次的 `remainingAmount`、不动 `expireAt`——若原批次已过期，回退后仍是过期
   *    （`consumeFifo` 只看 `expireAt > now`，不会「退款复活」）；
   *  - 新生成的 REFUND 是**台账记录**（remainingAmount=0），真正的积分在原批次里，不会重复计入。
   */
  async refundExchangePoints(
    tx: Prisma.TransactionClient,
    couponInstanceId: number,
    operatorId: number | null,
  ): Promise<{ total: number; details: Array<{ sourceTxnId: number; amount: number }> }> {
    const spends = await tx.pointTransaction.findMany({
      where: {
        relatedCouponInstanceId: couponInstanceId,
        type: PointTxnType.SPEND,
        originBatchId: { not: null },
      },
      orderBy: { id: 'asc' },
    });
    if (spends.length === 0) return { total: 0, details: [] };

    const userId = spends[0].userId;
    const account = await tx.pointAccount.findUnique({ where: { userId } });
    if (!account) return { total: 0, details: [] };

    let total = 0;
    const details: Array<{ sourceTxnId: number; amount: number }> = [];
    let running = account.balance;
    for (const s of spends) {
      const take = -s.amount;
      const sourceId = s.originBatchId as number;
      await tx.$executeRaw(
        Prisma.sql`UPDATE point_transactions SET remainingAmount = remainingAmount + ${take} WHERE id = ${sourceId}`,
      );
      running += take;
      await tx.pointTransaction.create({
        data: {
          userId,
          accountId: account.id,
          type: PointTxnType.REFUND,
          amount: take,
          remainingAmount: 0,
          balanceAfter: running,
          merchantId: s.merchantId,
          operatorId,
          relatedCouponInstanceId: couponInstanceId,
          originBatchId: sourceId,
          remark: `订单回退：退回批次 #${sourceId} 的 ${take} 分（保留原有效期）`,
        },
      });
      total += take;
      details.push({ sourceTxnId: sourceId, amount: take });
    }

    if (total > 0) {
      const affected = await tx.$executeRaw(
        Prisma.sql`UPDATE point_accounts SET balance = balance + ${total}, totalSpent = totalSpent - ${total}, version = version + 1 WHERE userId = ${userId} AND version = ${account.version}`,
      );
      if (affected === 0) throw new ConcurrentSignal();
    }
    return { total, details };
  }

  /**
   * S3.4：在调用方事务内做负向积分冲正（走 FIFO + ADJUST 负流水 + 账户扣减）。
   * 用于异常订单「金额录入错误」场景（`amount` 为负）。账户乐观锁冲突抛 {@link ConcurrentSignal}。
   */
  async adjustInTx(
    tx: Prisma.TransactionClient,
    userId: number,
    amount: number,
    operatorId: number | null,
    reason: string,
  ): Promise<{ balanceAfter: number }> {
    const points = Math.abs(amount);
    const now = new Date();
    await this.consumeFifo(tx, userId, points, now);
    const account = await this.ensureAccount(tx, userId);
    const balanceAfter = account.balance - points;
    await tx.pointTransaction.create({
      data: {
        userId,
        accountId: account.id,
        type: PointTxnType.ADJUST,
        amount: -points,
        remainingAmount: 0,
        balanceAfter,
        operatorId,
        remark: reason,
      },
    });
    const affected = await tx.$executeRaw(
      Prisma.sql`UPDATE point_accounts SET balance = balance - ${points}, totalSpent = totalSpent + ${points}, version = version + 1 WHERE userId = ${userId} AND version = ${account.version}`,
    );
    if (affected === 0) throw new ConcurrentSignal();
    return { balanceAfter };
  }

  // ---------------------------------------------------------------- 内部工具

  /** 账户不存在则建（首次送积分时懒创建），返回带 version 的账户 */
  private async ensureAccount(tx: Prisma.TransactionClient, userId: number) {
    // 原子 upsert（MySQL 映射为 INSERT ... ON DUPLICATE KEY UPDATE）：
    // 并发下两个事务同时为「新用户」建账户时不再撞 point_accounts.userId 唯一键，
    // 否则这笔合法操作会被误判为业务冲突（S4 收口：新用户并发录单回归用例 C2b）。
    return tx.pointAccount.upsert({ where: { userId }, create: { userId }, update: {} });
  }

  /**
   * 解析消费归属：商家 / 门店由 JWT 推导，**不信任入参**
   * （商家传别家 merchantId → 403；店员传别家门店 → 403）。
   */
  private async resolveMerchantStore(dto: EarnPointsDto, user: JwtPayload) {
    if (user.userType === 'PLATFORM') {
      const merchantId = dto.merchantId;
      if (!merchantId) {
        throw BizException.badRequest(ReasonCode.MERCHANT_ID_REQUIRED, '平台管理员录单必须指定 merchantId');
      }
      return this.assertStore(merchantId, dto.storeId ?? null);
    }

    if (user.userType === 'STORE') {
      if (!user.storeId) {
        throw BizException.forbidden(ReasonCode.SCOPE_NOT_READY, '店员账号未绑定门店');
      }
      const store = await this.prisma.store.findUnique({
        where: { id: user.storeId },
        select: { id: true, merchantId: true },
      });
      if (!store) {
        throw BizException.forbidden(ReasonCode.SCOPE_NOT_READY, '店员绑定的门店不存在');
      }
      if (dto.storeId && dto.storeId !== store.id) {
        throw BizException.forbidden(ReasonCode.STORE_NOT_OWNED, '店员只能录本门店的消费');
      }
      if (dto.merchantId && dto.merchantId !== store.merchantId) {
        throw BizException.forbidden(ReasonCode.FORBIDDEN_SCOPE, '无权为其他商家录单送积分');
      }
      return { merchantId: store.merchantId, storeId: store.id };
    }

    // MERCHANT（主体 / 附属）
    const merchantId = user.merchantId;
    if (!merchantId) {
      throw BizException.forbidden(ReasonCode.SCOPE_NOT_READY, '账号未关联商家');
    }
    if (dto.merchantId && dto.merchantId !== merchantId) {
      throw BizException.forbidden(ReasonCode.FORBIDDEN_SCOPE, '无权为其他商家录单送积分');
    }
    return this.assertStore(merchantId, dto.storeId ?? null);
  }

  /**
   * 门店必须属于该商家（不传门店则只认商家）。
   * **主体商家可以用直属附属的门店**（与券核销同口径：消费确实发生在门店，积分归属仍是门店所属商家）
   * ——注意积分记在**门店所属商家**名下，不是录单人商家，否则对账时门店维度会对不上。
   */
  private async assertStore(merchantId: number, storeId: number | null) {
    if (!storeId) return { merchantId, storeId: null };
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, merchantId: true, merchant: { select: { id: true, parentId: true } } },
    });
    if (!store) {
      throw BizException.forbidden(ReasonCode.STORE_NOT_OWNED, `门店 #${storeId} 不存在`);
    }
    const own = store.merchantId === merchantId;
    const childOfMine = store.merchant?.parentId === merchantId;
    if (!own && !childOfMine) {
      throw BizException.forbidden(ReasonCode.STORE_NOT_OWNED, `门店 #${storeId} 不属于商家 #${merchantId} 及其附属`);
    }
    // 积分记在门店所属商家名下（对账口径：消费发生在哪家店，积分就算哪家的）
    return { merchantId: store.merchantId, storeId };
  }

  /** 订单解析：orderId / orderNo 二选一（缺失由调用方按 ORDER_ID_REQUIRED 处理）；订单不存在 → 404；归属不符 → 400 */
  private async resolveOrder(dto: EarnPointsDto) {
    let order = null;
    if (dto.orderId) {
      order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        select: { id: true, orderNo: true, userId: true },
      });
      if (!order) {
        throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, `订单 #${dto.orderId} 不存在`);
      }
    } else if (dto.orderNo) {
      order = await this.prisma.order.findUnique({
        where: { orderNo: dto.orderNo },
        select: { id: true, orderNo: true, userId: true },
      });
      if (!order) {
        throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, `订单 ${dto.orderNo} 不存在`);
      }
    }
    if (order && order.userId !== dto.userId) {
      throw BizException.badRequest(
        ReasonCode.RESOURCE_NOT_FOUND,
        `订单 ${order.orderNo} 不属于用户 #${dto.userId}，不能给他送积分`,
      );
    }
    return order;
  }

  /** 积分规则：商家级优先，其次平台级（merchantId=0）。都没有 → 409。 */
  private async resolveRule(merchantId: number | null) {
    if (merchantId) {
      const merchantRule = await this.prisma.pointRule.findFirst({
        where: { merchantId, status: 1 },
        orderBy: { id: 'desc' },
      });
      if (merchantRule) return merchantRule;
    }
    const platformRule = await this.prisma.pointRule.findFirst({
      where: { merchantId: 0, status: 1 },
      orderBy: { id: 'desc' },
    });
    if (platformRule) return platformRule;
    throw BizException.conflict(
      ReasonCode.POINT_RULE_NOT_FOUND,
      '没有生效中的积分规则（商家级与平台级都没有），请先配置积分规则',
    );
  }

  /** 券有效期：FIXED 用 validEnd；AFTER_RECEIVE_DAYS 按兑换时刻 + N 天（与券发放同口径） */
  private computeCouponExpireAt(
    template: { validType: string; validEnd: Date | null; validDays: number },
    now: Date,
  ): Date {
    if (template.validType === 'FIXED') {
      const end = template.validEnd ?? new Date(now.getTime() + template.validDays * 86400_000);
      return end.getTime() > now.getTime() ? end : now;
    }
    return new Date(now.getTime() + (template.validDays || 30) * 86400_000);
  }

  /** 有效期计算：FIXED_MONTHS 按自然月；YEAR_END 到当年 12-31 23:59:59 */
  private computeExpireAt(rule: { pointsValidMonths: number; expireMode: ExpireMode }, now: Date): Date {
    if (rule.expireMode === ExpireMode.YEAR_END) {
      return new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59));
    }
    const d = new Date(now);
    d.setMonth(d.getMonth() + rule.pointsValidMonths);
    return d;
  }

  /**
   * 流水可见范围：平台全量 / 商家=自己+直属附属（**含无归属的人工调整**）/ 店员=本店。
   *
   * 为什么商家视角要额外放行 `merchantId: null`：人工调整（ADJUST）是运营动作、不挂商家，
   * 若按商家过滤，主体商家反而看不到自己刚做的调账——过滤是为了隔离别人，不是为了藏自己的操作。
   * 店员视角仍然严格只看本店（不给他看跨店调账）。
   */
  private async scopeFilter(user: JwtPayload): Promise<Prisma.PointTransactionWhereInput> {
    if (user.userType === 'PLATFORM') return {};

    if (user.userType === 'STORE') {
      if (!user.storeId) return { id: -1 };
      return { storeId: user.storeId };
    }

    const merchantId = user.merchantId;
    if (!merchantId) return { id: -1 };
    const merchants = await this.prisma.merchant.findMany({
      where: { OR: [{ id: merchantId }, { parentId: merchantId }] },
      select: { id: true, type: true },
    });
    const ids = merchants.map((m) => m.id);
    const self = merchants.find((m) => m.id === merchantId);
    // 只有**主体商家**才看得到无商家归属的流水（人工调整）：
    // 调账是主体运营动作，附属商家没有理由看到主体给他用户做的调账。
    if (self?.type === MerchantType.MAIN) {
      return { OR: [{ merchantId: { in: ids } }, { merchantId: null }] };
    }
    return { merchantId: { in: ids } };
  }

  /** 可见商家 id 列表（用于拒绝「指定别人 merchantId」的查询）；平台返回 null 表示不限 */
  private async visibleMerchantIds(user: JwtPayload): Promise<number[] | null> {
    if (user.userType === 'PLATFORM') return null;
    if (user.userType === 'STORE') {
      if (!user.storeId) return [];
      const store = await this.prisma.store.findUnique({
        where: { id: user.storeId },
        select: { merchantId: true },
      });
      return store ? [store.merchantId] : [];
    }
    const merchantId = user.merchantId;
    if (!merchantId) return [];
    const merchants = await this.prisma.merchant.findMany({
      where: { OR: [{ id: merchantId }, { parentId: merchantId }] },
      select: { id: true },
    });
    return merchants.map((m) => m.id);
  }

  /**
   * 可写口径的用户校验（人工调整用）
   *
   * - 平台管理员：不限；
   * - **主体商家**：不限 —— 积分是主体的负债，给谁加、给谁扣是自己说了算的事；
   * - 附属商家 / 店员：只能动「在自己体系内产生过积分流水」的用户（否则等于能凭空给任意用户送积分）。
   */
  private async assertWritableUser(userId: number, user: JwtPayload) {
    if (user.userType === 'PLATFORM') return;
    if (user.userType === 'MERCHANT' && user.merchantId) {
      const self = await this.prisma.merchant.findUnique({
        where: { id: user.merchantId },
        select: { type: true },
      });
      if (self?.type === MerchantType.MAIN) return;
    }
    await this.assertUserVisible(userId, user);
  }

  /** 账户 / 流水维度的用户可见性校验：越权 → 403（不泄露「该用户是否存在」） */
  private async assertUserVisible(userId: number, user: JwtPayload) {
    if (user.userType === 'PLATFORM') return;
    const scope = await this.scopeFilter(user);
    const hit = await this.prisma.pointTransaction.findFirst({
      where: { userId, ...scope },
      select: { id: true },
    });
    if (!hit) {
      throw BizException.forbidden(ReasonCode.FORBIDDEN_SCOPE, '无权查看该用户的积分数据');
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 唯一约束冲突：Prisma P2002，或 MySQL 1062（走 $executeRaw 时） */
function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  const msg = (e as Error)?.message ?? '';
  return code === 'P2002' || msg.includes('Duplicate entry');
}

/**
 * 是否**精确**命中「同一订单只送一次」的唯一索引 `uniq_point_earn_order(relatedOrderId, type)`。
 * 用于把 P2002 精确分类：只有这个唯一键才代表「订单已送分」，其它唯一键（如并发建账户）
 * 不应被误报为 ORDER_POINTS_ALREADY_EARNED（S4 收口教训）。
 */
function isEarnOrderUniqueViolation(e: unknown): boolean {
  if (!isUniqueViolation(e)) return false;
  const target = (e as { meta?: { target?: unknown } })?.meta?.target;
  const s = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return s.includes('relatedOrderId') || s.includes('uniq_point_earn_order');
}

/** 是否精确命中积分规则唯一索引 `point_rules(merchantId, status)` */
function isPointRuleUniqueViolation(e: unknown): boolean {
  if (!isUniqueViolation(e)) return false;
  const target = (e as { meta?: { target?: unknown } })?.meta?.target;
  const s = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return s.includes('point_rules') || s.includes('merchantId');
}

/**
 * 瞬时锁错误：MySQL 1213（死锁）/ 1205（锁等待超时）/ Prisma P2034（写冲突或死锁）。
 * 这类错误**不代表业务规则拒绝**，重试一次通常就过了；不重试就会变成 500。
 */
function isTransientLockError(e: unknown): boolean {
  const msg = (e as Error)?.message ?? '';
  const code = (e as { code?: string })?.code;
  return (
    code === 'P2034' ||
    msg.includes('Deadlock found') ||
    msg.includes('Lock wait timeout') ||
    msg.includes('deadlock detected')
  );
}
