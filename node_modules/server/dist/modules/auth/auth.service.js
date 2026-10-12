"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcryptjs_1 = require("bcryptjs");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const wx_service_1 = require("./wx.service");
const BCRYPT_ROUNDS = 10;
let AuthService = class AuthService {
    constructor(prisma, jwt, wx) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.wx = wx;
        this.logger = new common_1.Logger('Auth');
    }
    async userLogin(code, ip) {
        const session = await this.wx.code2session(code, ip);
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
        }
        else if (session.unionid && user.unionid !== session.unionid) {
            user = await this.prisma.user.update({ where: { id: user.id }, data: { unionid: session.unionid } });
        }
        if (user.status !== 'ACTIVE') {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.ACCOUNT_DISABLED, '用户已被禁用');
        }
        await this.prisma.pointAccount.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
        const payload = {
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
    async login(username, password, ip) {
        const account = await this.prisma.adminUser.findUnique({
            where: { username },
            include: { merchant: { select: { id: true, name: true, status: true } } },
        });
        if (!account || !(0, bcryptjs_1.compareSync)(password, account.passwordHash)) {
            throw biz_exception_1.BizException.unauthorized(biz_exception_1.ReasonCode.INVALID_CREDENTIALS, '账号或密码错误');
        }
        if (account.status !== 'ACTIVE') {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.ACCOUNT_DISABLED, '账号已停用');
        }
        if (account.merchant && account.merchant.status !== 'APPROVED') {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.MERCHANT_SUSPENDED, `所属商家状态为 ${account.merchant.status}，暂不可登录`);
        }
        const { roles, permissions } = await this.loadGrants(account.id);
        const payload = {
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
    async profile(userId) {
        const account = await this.prisma.adminUser.findUnique({
            where: { id: userId },
            include: {
                merchant: { select: { id: true, name: true, code: true, type: true, status: true } },
            },
        });
        if (!account) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '账号不存在');
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
    async permissions(userId) {
        const { roles, permissions } = await this.loadGrants(userId);
        return { roles, permissions };
    }
    async updatePassword(userId, dto) {
        const account = await this.prisma.adminUser.findUnique({ where: { id: userId } });
        if (!account) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '账号不存在');
        }
        if (!(0, bcryptjs_1.compareSync)(dto.oldPassword, account.passwordHash)) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.PASSWORD_MISMATCH, '原密码不正确');
        }
        if (dto.oldPassword === dto.newPassword) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.PASSWORD_TOO_WEAK, '新密码不能与原密码相同');
        }
        await this.prisma.adminUser.update({
            where: { id: userId },
            data: {
                passwordHash: (0, bcryptjs_1.hashSync)(dto.newPassword, BCRYPT_ROUNDS),
                mustChangePassword: false,
            },
        });
        this.logger.log(`账号 ${account.username}(id=${userId}) 修改密码成功`);
        return { updated: true, mustChangePassword: false };
    }
    async loadGrants(userId) {
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
        const permissions = Array.from(new Set(links.flatMap((l) => l.role.permissions.map((rp) => rp.permission.code)))).sort();
        return { roles, permissions };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        wx_service_1.WxService])
], AuthService);
//# sourceMappingURL=auth.service.js.map