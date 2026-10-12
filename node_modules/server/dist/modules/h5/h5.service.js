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
exports.H5Service = void 0;
const common_1 = require("@nestjs/common");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const point_service_1 = require("../point/point.service");
let H5Service = class H5Service {
    constructor(prisma, points) {
        this.prisma = prisma;
        this.points = points;
    }
    scope(p) {
        return {
            sub: p.userId,
            username: `user:${p.userId}`,
            merchantId: null,
            storeId: null,
            userType: 'PLATFORM',
            roles: [],
            permissions: [],
        };
    }
    async me(p) {
        const user = await this.prisma.user.findUnique({
            where: { id: p.userId },
            select: { id: true, nickname: true, phone: true, avatar: true, openid: true, unionid: true, status: true, registeredAt: true },
        });
        if (!user)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '用户不存在');
        return user;
    }
    async account(p) {
        return this.points.accountDetail(p.userId, this.scope(p));
    }
    async transactions(p, query) {
        return this.points.listTransactions({ ...query, userId: p.userId, merchantId: undefined, storeId: undefined }, this.scope(p));
    }
    async exchangeRecords(p, query) {
        return this.points.listExchangeRecords({ ...query, userId: p.userId }, this.scope(p));
    }
    async templates() {
        const rows = await this.prisma.couponTemplate.findMany({
            where: { status: 'PUBLISHED', pointsCost: { gt: 0 } },
            orderBy: { id: 'asc' },
        });
        return {
            list: rows
                .filter((t) => t.totalStock - t.issuedCount > 0)
                .map((t) => ({
                id: t.id,
                name: t.name,
                subtitle: t.subtitle,
                status: t.status,
                faceValue: Number(t.faceValue),
                thresholdAmount: Number(t.thresholdAmount),
                pointsCost: t.pointsCost,
                perUserLimit: t.perUserLimit,
                totalStock: t.totalStock,
                remainingStock: t.totalStock - t.issuedCount,
            })),
        };
    }
    async exchange(p, dto) {
        const forged = dto.userId;
        if (forged && forged !== p.userId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '不能为其它用户兑换积分');
        }
        return this.points.exchange({ userId: p.userId, templateId: dto.templateId, requestId: dto.requestId, channel: dto.channel ?? 'H5', remark: dto.remark }, this.scope(p));
    }
};
exports.H5Service = H5Service;
exports.H5Service = H5Service = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        point_service_1.PointService])
], H5Service);
//# sourceMappingURL=h5.service.js.map