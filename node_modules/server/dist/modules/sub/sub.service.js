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
exports.SubService = void 0;
const common_1 = require("@nestjs/common");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const merchant_scope_guard_1 = require("../../common/guards/merchant-scope.guard");
let SubService = class SubService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    listStores(scope, keyword) {
        const base = (0, merchant_scope_guard_1.scopedWhere)(scope);
        return this.prisma.store.findMany({
            where: {
                ...base,
                ...(keyword ? { name: { contains: keyword } } : {}),
            },
            select: {
                id: true,
                merchantId: true,
                name: true,
                code: true,
                contactName: true,
                contactPhone: true,
                address: true,
                status: true,
            },
            orderBy: { id: 'asc' },
        });
    }
    async getStore(scope, id) {
        const base = (0, merchant_scope_guard_1.scopedWhere)(scope);
        const store = await this.prisma.store.findFirst({
            where: { id, ...base },
            select: {
                id: true,
                merchantId: true,
                name: true,
                code: true,
                contactName: true,
                contactPhone: true,
                province: true,
                city: true,
                district: true,
                address: true,
                lng: true,
                lat: true,
                businessHours: true,
                logo: true,
                status: true,
            },
        });
        if (!store) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '门店不存在或无权查看');
        }
        return store;
    }
};
exports.SubService = SubService;
exports.SubService = SubService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SubService);
//# sourceMappingURL=sub.service.js.map