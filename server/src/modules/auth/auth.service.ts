import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compareSync, hashSync } from 'bcryptjs';
import { BizException, ReasonCode } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { JwtPayload } from './jwt-payload';
import { UserJwtPayload } from './user-jwt-payload';
import { WxService } from './wx.service';

const BCRYPT_ROUNDS = 10;

/** 登录成功后返回给前端的账号上下文 */
export interface LoginResult {
  accessToken: string;
  expiresIn: string;
  user: {
    id: number;
    username: string;
    realName: string | null;
    phone: string | null;
    userType: string;
    merchantId: number | null;
    merchantName: string | null;
    storeId: number | null;
    storeName: string | null;
    lastLoginAt: Date | null;
  };
  roles: string[];
  permissions: string[];
  /**
   * true = 系统生成的初始账号还没改过密。
   * 前端看到这个值要强制跳改密页——未改密前除 PUT /auth/password 外的接口都会 403。
   */
  mustChangePassword: boolean;
}

/**
 * 认证服务：账号密码登录 / 资料 / 改密 / 权限码
 *
 * 安全性：
 *  - 登录失败一律返回同一句话 + 401，不区分「账号不存在」与「密码错误」，避免账号枚举。
 *  - bcrypt 比对；改密后旧密码立即失效（password_hash 全量覆盖）。
 *  - 账号停用 / 所属商家暂停时拒绝登录。
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly wx: WxService,
  ) {}

  /**
   * C 端登录（S5.1）：微信 code → openid/unionid → 找到/创建 users → 签发 C 端 JWT。
   *
   * 与后台登录**分离**：payload 带 `kind:'USER'`，只能访问 `/h5/**`。
   * 用户不存在则按 openid 自动创建（phone 用确定性占位，保证唯一）。
   */
  async userLogin(code: string) {
    const session = await this.wx.code2session(code);

    let user = await this.prisma.user.findFirst({ where: { openid: session.openid } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone: `wx_${session.openid.slice(-16)}`,
          nickname: '微信用户',
          openid: session.openid,
          unionid: session.unionid ?? null,
          registeredAt: new Date(),
        },
      });
    } else if (session.unionid && user.unionid !== session.unionid) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { unionid: session.unionid } });
    }

    if (user.status !== 'ACTIVE') {
      throw BizException.forbidden(ReasonCode.ACCOUNT_DISABLED, '用户已被禁用');
    }

    // 开积分账户（幂等）：新用户首次登录即拥有账户，避免 H5「我的积分」因无账户而 404
    await this.prisma.pointAccount.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });

    const payload: UserJwtPayload = {
      kind: 'USER',
      sub: user.id,
      userId: user.id,
      openid: session.openid,
      unionid: user.unionid ?? null,
    };

    this.logger.log(`C 端登录成功 userId=${user.id} openid=${session.openid}`);

    return {
      accessToken: this.jwt.sign(payload),
      expiresIn: process.env.JWT_EXPIRES_IN ?? '2h',
      user: {
        id: user.id,
        nickname: user.nickname,
        phone: user.phone,
        openid: user.openid,
        unionid: user.unionid,
      },
    };
  }

  async login(username: string, password: string, ip?: string): Promise<LoginResult> {
    const account = await this.prisma.adminUser.findUnique({
      where: { username },
      include: { merchant: { select: { id: true, name: true, status: true } } },
    });

    if (!account || !compareSync(password, account.passwordHash)) {
      throw BizException.unauthorized(
        ReasonCode.INVALID_CREDENTIALS,
        '账号或密码错误',
      );
    }

    if (account.status !== 'ACTIVE') {
      throw BizException.forbidden(ReasonCode.ACCOUNT_DISABLED, '账号已停用');
    }

    if (account.merchant && account.merchant.status !== 'APPROVED') {
      throw BizException.forbidden(
        ReasonCode.MERCHANT_SUSPENDED,
        `所属商家状态为 ${account.merchant.status}，暂不可登录`,
      );
    }

    const { roles, permissions } = await this.loadGrants(account.id);

    const payload: JwtPayload = {
      sub: account.id,
      username: account.username,
      merchantId: account.merchantId ?? null,
      storeId: account.storeId ?? null,
      userType: account.userType,
      roles,
      permissions,
    };

    await this.prisma.adminUser.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip ?? null },
    });

    this.logger.log(`登录成功 ${account.username}(id=${account.id}) roles=[${roles.join(',')}]`);

    return {
      accessToken: this.jwt.sign(payload),
      expiresIn: process.env.JWT_EXPIRES_IN ?? '2h',
      user: {
        id: account.id,
        username: account.username,
        realName: account.realName,
        phone: account.phone,
        userType: account.userType,
        merchantId: account.merchantId ?? null,
        merchantName: account.merchant?.name ?? null,
        storeId: account.storeId ?? null,
        storeName: null,
        lastLoginAt: account.lastLoginAt,
      },
      roles,
      permissions,
      mustChangePassword: account.mustChangePassword,
    };
  }

  async profile(userId: number) {
    const account = await this.prisma.adminUser.findUnique({
      where: { id: userId },
      include: {
        merchant: { select: { id: true, name: true, code: true, type: true, status: true } },
      },
    });
    if (!account) {
      throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, '账号不存在');
    }

    const store = account.storeId
      ? await this.prisma.store.findUnique({
          where: { id: account.storeId },
          select: { id: true, name: true },
        })
      : null;

    const { roles, permissions } = await this.loadGrants(account.id);

    return {
      id: account.id,
      username: account.username,
      realName: account.realName,
      phone: account.phone,
      userType: account.userType,
      status: account.status,
      lastLoginAt: account.lastLoginAt,
      merchant: account.merchant,
      store,
      roles,
      permissions,
    };
  }

  async permissions(userId: number) {
    const { roles, permissions } = await this.loadGrants(userId);
    return { roles, permissions };
  }

  async updatePassword(userId: number, dto: UpdatePasswordDto) {
    const account = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!account) {
      throw BizException.notFound(ReasonCode.RESOURCE_NOT_FOUND, '账号不存在');
    }
    if (!compareSync(dto.oldPassword, account.passwordHash)) {
      throw BizException.badRequest(ReasonCode.PASSWORD_MISMATCH, '原密码不正确');
    }
    if (dto.oldPassword === dto.newPassword) {
      throw BizException.badRequest(ReasonCode.PASSWORD_TOO_WEAK, '新密码不能与原密码相同');
    }

    await this.prisma.adminUser.update({
      where: { id: userId },
      data: {
        passwordHash: hashSync(dto.newPassword, BCRYPT_ROUNDS),
        // 改密成功即解除「首次登录必须改密」的限制，后续接口恢复正常访问
        mustChangePassword: false,
      },
    });

    this.logger.log(`账号 ${account.username}(id=${userId}) 修改密码成功`);
    return { updated: true, mustChangePassword: false };
  }

  /** 角色码 + 去重后的权限码（登录时一次性组装进 JWT） */
  private async loadGrants(userId: number): Promise<{ roles: string[]; permissions: string[] }> {
    const links = await this.prisma.adminUserRole.findMany({
      where: { adminUserId: userId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: { select: { code: true } } } },
          },
        },
      },
    });

    const roles = links.map((l) => l.role.code);
    const permissions = Array.from(
      new Set(
        links.flatMap((l) => l.role.permissions.map((rp) => rp.permission.code)),
      ),
    ).sort();

    return { roles, permissions };
  }
}
