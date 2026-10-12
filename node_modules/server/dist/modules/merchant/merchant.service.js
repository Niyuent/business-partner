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
exports.MerchantService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const bcryptjs_1 = require("bcryptjs");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const audit_service_1 = require("../audit-log/audit.service");
const BCRYPT_ROUNDS = 10;
const PWD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%';
let MerchantService = class MerchantService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
        this.logger = new common_1.Logger('Merchant');
    }
    async createApplication(dto, ip, ua) {
        const main = await this.prisma.merchant.findFirst({ where: { type: client_1.MerchantType.MAIN } });
        if (!main) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '平台未配置主体商家');
        }
        const merchant = await this.prisma.merchant.create({
            data: {
                parentId: main.id,
                type: client_1.MerchantType.SUB,
                name: dto.name,
                code: await this.nextMerchantCode(),
                contactName: dto.contactName,
                contactPhone: dto.contactPhone,
                licenseNo: dto.licenseNo,
                province: dto.province,
                city: dto.city,
                district: dto.district,
                address: dto.address,
                licenseImages: (dto.licenseImages ?? undefined),
                settleContact: dto.settleContact,
                status: client_1.MerchantStatus.PENDING,
            },
        });
        await this.audit.record({
            module: 'merchant',
            action: 'application:create',
            targetType: 'merchant',
            targetId: merchant.id,
            after: { name: merchant.name, code: merchant.code, status: merchant.status },
            operatorType: 'MERCHANT_APPLICANT',
            operatorName: dto.contactName,
            ip,
            userAgent: ua,
        });
        return merchant;
    }
    async listApplications(query, user) {
        const where = {
            type: client_1.MerchantType.SUB,
            status: (query.status ?? 'PENDING'),
            ...(await this.visibilityWhere(user)),
        };
        const [list, total] = await Promise.all([
            this.prisma.merchant.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
                select: {
                    id: true,
                    code: true,
                    name: true,
                    contactName: true,
                    contactPhone: true,
                    licenseNo: true,
                    licenseImages: true,
                    province: true,
                    city: true,
                    district: true,
                    address: true,
                    status: true,
                    auditRemark: true,
                    auditedAt: true,
                    createdAt: true,
                },
            }),
            this.prisma.merchant.count({ where }),
        ]);
        return { list, total, page: query.page, pageSize: query.pageSize };
    }
    async approve(id, dto, user, ip, ua) {
        const result = await this.prisma.$transaction(async (tx) => {
            const { count } = await tx.merchant.updateMany({
                where: { id, type: client_1.MerchantType.SUB, status: client_1.MerchantStatus.PENDING },
                data: {
                    status: client_1.MerchantStatus.APPROVED,
                    auditorId: user.sub,
                    auditedAt: new Date(),
                    auditRemark: dto.auditRemark ?? null,
                },
            });
            if (count === 0) {
                await this.assertReviewable(tx, id);
            }
            const updated = await tx.merchant.findUniqueOrThrow({ where: { id } });
            let account = null;
            if (dto.createAccount !== false) {
                account = await this.createMerchantAdmin(tx, updated);
            }
            return { updated, account, prevStatus: client_1.MerchantStatus.PENDING };
        });
        await this.audit.record({
            operatorId: user.sub,
            operatorType: user.userType,
            operatorName: user.username,
            module: 'merchant',
            action: 'application:approve',
            targetType: 'merchant',
            targetId: id,
            before: { status: result.prevStatus },
            after: {
                status: result.updated.status,
                accountCreated: !!result.account,
                username: result.account?.username,
            },
            ip,
            userAgent: ua,
        });
        return {
            merchant: result.updated,
            account: result.account,
            hint: result.account ? '请立即保存初始口令，系统不再展示' : null,
        };
    }
    async reject(id, dto, user, ip, ua) {
        const result = await this.prisma.$transaction(async (tx) => {
            const { count } = await tx.merchant.updateMany({
                where: { id, type: client_1.MerchantType.SUB, status: client_1.MerchantStatus.PENDING },
                data: {
                    status: client_1.MerchantStatus.REJECTED,
                    auditorId: user.sub,
                    auditedAt: new Date(),
                    auditRemark: dto.auditRemark,
                },
            });
            if (count === 0) {
                await this.assertReviewable(tx, id);
            }
            return {
                updated: await tx.merchant.findUniqueOrThrow({ where: { id } }),
                prevStatus: client_1.MerchantStatus.PENDING,
            };
        });
        await this.audit.record({
            operatorId: user.sub,
            operatorType: user.userType,
            operatorName: user.username,
            module: 'merchant',
            action: 'application:reject',
            targetType: 'merchant',
            targetId: id,
            before: { status: result.prevStatus },
            after: { status: result.updated.status, auditRemark: dto.auditRemark },
            ip,
            userAgent: ua,
        });
        return result.updated;
    }
    async assertReviewable(tx, id) {
        const current = await tx.merchant.findUnique({ where: { id } });
        if (!current) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '申请不存在');
        }
        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.MERCHANT_NOT_PENDING, `该申请当前状态为 ${current.status}，不可重复审核`);
    }
    async list(query, user) {
        const where = {
            ...(query.status ? { status: query.status } : {}),
            ...(query.type ? { type: query.type } : {}),
            ...(query.keyword
                ? { OR: [{ name: { contains: query.keyword } }, { code: { contains: query.keyword } }] }
                : {}),
            ...(await this.visibilityWhere(user)),
        };
        const [list, total] = await Promise.all([
            this.prisma.merchant.findMany({
                where,
                orderBy: { id: 'asc' },
                skip: (query.page - 1) * query.pageSize,
                take: query.pageSize,
                select: {
                    id: true,
                    code: true,
                    name: true,
                    type: true,
                    contactName: true,
                    contactPhone: true,
                    status: true,
                    auditRemark: true,
                    createdAt: true,
                    parent: { select: { id: true, name: true } },
                    _count: { select: { stores: true, adminUsers: true } },
                },
            }),
            this.prisma.merchant.count({ where }),
        ]);
        return { list, total, page: query.page, pageSize: query.pageSize };
    }
    async detail(id, user) {
        const merchant = await this.prisma.merchant.findFirst({
            where: { id, ...(await this.visibilityWhere(user)) },
            include: {
                parent: { select: { id: true, name: true, code: true } },
                stores: { select: { id: true, name: true, code: true, status: true } },
                adminUsers: {
                    select: { id: true, username: true, realName: true, userType: true, status: true },
                },
            },
        });
        if (!merchant) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '商家不存在或无权查看');
        }
        return merchant;
    }
    async updateStatus(id, dto, user, ip, ua) {
        const merchant = await this.prisma.merchant.findUnique({ where: { id } });
        if (!merchant) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '商家不存在');
        }
        const activatable = [client_1.MerchantStatus.APPROVED, client_1.MerchantStatus.SUSPENDED];
        if (!activatable.includes(merchant.status)) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.MERCHANT_NOT_PENDING, `商家当前状态为 ${merchant.status}，需先通过入驻审核才能启停`);
        }
        const updated = await this.prisma.merchant.update({
            where: { id },
            data: {
                status: dto.status,
                auditorId: user.sub,
                auditedAt: new Date(),
                auditRemark: dto.remark ?? merchant.auditRemark,
            },
        });
        await this.audit.record({
            operatorId: user.sub,
            operatorType: user.userType,
            operatorName: user.username,
            module: 'merchant',
            action: dto.status === client_1.MerchantStatus.SUSPENDED ? 'merchant:suspend' : 'merchant:resume',
            targetType: 'merchant',
            targetId: id,
            before: { status: merchant.status },
            after: { status: updated.status, remark: dto.remark ?? null },
            ip,
            userAgent: ua,
        });
        this.logger.log(`商家 #${id} 状态 ${merchant.status} → ${updated.status}，操作人 ${user.username}`);
        return updated;
    }
    async visibilityWhere(user) {
        if (user.userType === 'PLATFORM')
            return {};
        if (!user.merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '账号未绑定商家，无法查看商家数据');
        }
        const own = await this.prisma.merchant.findUnique({
            where: { id: user.merchantId },
            select: { type: true },
        });
        if (own?.type === client_1.MerchantType.MAIN) {
            return { OR: [{ id: user.merchantId }, { parentId: user.merchantId }] };
        }
        return { id: user.merchantId };
    }
    async nextMerchantCode() {
        for (let i = 0; i < 20; i++) {
            const code = `SUB-${(0, crypto_1.randomInt)(1000, 9999)}${String((0, crypto_1.randomInt)(0, 9))}`;
            const exists = await this.prisma.merchant.findUnique({ where: { code } });
            if (!exists)
                return code;
        }
        throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '生成商家编码失败，请重试');
    }
    async createMerchantAdmin(tx, merchant) {
        const base = merchant.code.replace(/[^A-Za-z0-9]/g, '').toLowerCase() || 'sub';
        let username = base;
        let seq = 1;
        while (await tx.adminUser.findUnique({ where: { username } })) {
            username = `${base}${seq++}`;
        }
        const subAdmin = await tx.role.findUnique({ where: { code: 'SUB_ADMIN' } });
        if (!subAdmin) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '角色 SUB_ADMIN 不存在，请先执行 seed');
        }
        const password = randomPassword(12);
        const created = await tx.adminUser.create({
            data: {
                username,
                passwordHash: (0, bcryptjs_1.hashSync)(password, BCRYPT_ROUNDS),
                realName: merchant.contactName,
                merchantId: merchant.id,
                userType: client_1.AdminUserType.MERCHANT,
                mustChangePassword: true,
                roles: { create: [{ roleId: subAdmin.id }] },
            },
        });
        this.logger.log(`为商家 #${merchant.id} 创建管理员 ${username}（角色 SUB_ADMIN）`);
        return { username, password, adminUserId: created.id };
    }
};
exports.MerchantService = MerchantService;
exports.MerchantService = MerchantService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], MerchantService);
function randomPassword(len) {
    let out = '';
    for (let i = 0; i < len; i++) {
        out += PWD_CHARS[(0, crypto_1.randomInt)(PWD_CHARS.length)];
    }
    return out;
}
//# sourceMappingURL=merchant.service.js.map