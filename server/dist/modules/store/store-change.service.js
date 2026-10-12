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
exports.StoreChangeService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const audit_service_1 = require("../audit-log/audit.service");
const store_change_dto_1 = require("./dto/store-change.dto");
const STORE_FIELDS = {
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
};
let StoreChangeService = class StoreChangeService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async scope(user) {
        if (user.userType === 'PLATFORM')
            return { merchantId: null, storeId: null };
        if (user.userType === 'STORE')
            return { merchantId: user.merchantId ?? null, storeId: user.storeId ?? null };
        const me = await this.prisma.merchant.findUnique({
            where: { id: user.merchantId ?? -1 },
            select: { type: true },
        });
        if (me?.type === client_1.MerchantType.MAIN)
            return { merchantId: null, storeId: null };
        return { merchantId: user.merchantId ?? null, storeId: null };
    }
    async assertStoreInScope(storeId, scope) {
        const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: STORE_FIELDS });
        if (!store)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '门店不存在');
        if (scope.storeId !== null && store.id !== scope.storeId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, '无权操作该门店');
        }
        if (scope.merchantId !== null && store.merchantId !== scope.merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, '无权操作该门店');
        }
        return store;
    }
    assertReviewer(scope) {
        if (scope.merchantId !== null || scope.storeId !== null) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '门店变更由主体商家审核');
        }
    }
    normalize(field, value) {
        if (value === null || value === undefined)
            return null;
        if (field === 'lng' || field === 'lat')
            return Number(value);
        return value;
    }
    pickChanges(store, dto) {
        const changes = {};
        const src = dto;
        for (const field of store_change_dto_1.CHANGEABLE_FIELDS) {
            const next = src[field];
            if (next === undefined)
                continue;
            const old = this.normalize(field, store[field]);
            const to = this.normalize(field, next);
            if (String(old ?? '') === String(to ?? ''))
                continue;
            changes[field] = { old, new: to };
        }
        return changes;
    }
    async submit(storeId, dto, user, rawBody, ip, ua) {
        const dirty = store_change_dto_1.FORBIDDEN_FIELDS.filter((f) => rawBody && Object.prototype.hasOwnProperty.call(rawBody, f));
        if (dirty.length) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.STORE_CHANGE_FIELD_FORBIDDEN, `以下字段不允许变更：${dirty.join('、')}`);
        }
        const scope = await this.scope(user);
        const store = await this.assertStoreInScope(storeId, scope);
        const changes = this.pickChanges(store, dto);
        if (Object.keys(changes).length === 0) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.STORE_CHANGE_NO_DIFF, '未检测到任何有效变更');
        }
        const pending = await this.prisma.storeChangeRequest.findFirst({
            where: { storeId, status: client_1.ChangeStatus.PENDING },
            select: { id: true },
        });
        if (pending) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.STORE_CHANGE_PENDING_EXISTS, `该门店已有待审核申请（#${pending.id}），请先作废后再提交`);
        }
        const created = await this.prisma.storeChangeRequest.create({
            data: {
                storeId,
                merchantId: store.merchantId,
                applicantId: user.sub,
                changes: changes,
                reason: dto.reason ?? null,
                status: client_1.ChangeStatus.PENDING,
            },
        });
        await this.audit.record({
            operatorId: user.sub,
            operatorType: user.userType,
            operatorName: user.username,
            module: 'store',
            action: 'store:change-submit',
            targetType: 'store_change_request',
            targetId: created.id,
            after: { storeId, changes },
            ip,
            userAgent: ua,
        });
        return created;
    }
    async listForStore(storeId, user) {
        const scope = await this.scope(user);
        await this.assertStoreInScope(storeId, scope);
        return this.prisma.storeChangeRequest.findMany({
            where: { storeId },
            orderBy: { id: 'desc' },
            take: 50,
        });
    }
    async listForReview(query, user) {
        const scope = await this.scope(user);
        this.assertReviewer(scope);
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const where = {
            ...(query.status ? { status: query.status } : {}),
            ...(query.storeId ? { storeId: query.storeId } : {}),
            ...(query.merchantId ? { merchantId: query.merchantId } : {}),
        };
        const [rows, total] = await Promise.all([
            this.prisma.storeChangeRequest.findMany({
                where,
                orderBy: [{ status: 'asc' }, { id: 'desc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: { store: { select: { id: true, name: true, code: true, merchantId: true } } },
            }),
            this.prisma.storeChangeRequest.count({ where }),
        ]);
        return { list: rows, total, page, pageSize };
    }
    async detail(id, user) {
        const scope = await this.scope(user);
        const req = await this.prisma.storeChangeRequest.findUnique({
            where: { id },
            include: { store: { select: { id: true, name: true, code: true, merchantId: true } } },
        });
        if (!req)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '变更申请不存在');
        if (scope.storeId !== null && req.storeId !== scope.storeId) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '变更申请不存在');
        }
        if (scope.merchantId !== null && req.merchantId !== scope.merchantId) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '变更申请不存在');
        }
        return req;
    }
    async review(id, dto, user, ip, ua) {
        const scope = await this.scope(user);
        this.assertReviewer(scope);
        const req = await this.prisma.storeChangeRequest.findUnique({ where: { id } });
        if (!req)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '变更申请不存在');
        if (req.status !== client_1.ChangeStatus.PENDING) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.STORE_CHANGE_NOT_PENDING, '该申请已审核，不可重复处理');
        }
        const approve = dto.decision === 'APPROVE';
        if (!approve && !dto.remark?.trim()) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.STORE_CHANGE_REASON_REQUIRED, '驳回时必须填写原因');
        }
        const changes = (req.changes ?? {});
        const result = await this.prisma.$transaction(async (tx) => {
            if (approve) {
                const data = {};
                for (const [field, entry] of Object.entries(changes)) {
                    if (!store_change_dto_1.CHANGEABLE_FIELDS.includes(field))
                        continue;
                    data[field] = this.normalize(field, entry.new);
                }
                if (Object.keys(data).length) {
                    await tx.store.update({ where: { id: req.storeId }, data });
                }
            }
            const updated = await tx.storeChangeRequest.update({
                where: { id },
                data: {
                    status: approve ? client_1.ChangeStatus.APPROVED : client_1.ChangeStatus.REJECTED,
                    reviewerId: user.sub,
                    reviewRemark: dto.remark ?? null,
                    reviewedAt: new Date(),
                },
            });
            await this.audit.record({
                operatorId: user.sub,
                operatorType: user.userType,
                operatorName: user.username,
                module: 'store',
                action: approve ? 'store:change-approve' : 'store:change-reject',
                targetType: 'store_change_request',
                targetId: id,
                before: { status: client_1.ChangeStatus.PENDING, changes },
                after: { status: updated.status, remark: dto.remark ?? null },
                ip,
                userAgent: ua,
            }, tx);
            return updated;
        });
        return result;
    }
    async cancel(id, user, ip, ua) {
        const scope = await this.scope(user);
        const req = await this.prisma.storeChangeRequest.findUnique({ where: { id } });
        if (!req)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '变更申请不存在');
        if (scope.storeId !== null && req.storeId !== scope.storeId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, '无权操作该门店');
        }
        if (scope.merchantId !== null && req.merchantId !== scope.merchantId) {
            throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, '无权操作该门店');
        }
        if (req.status !== client_1.ChangeStatus.PENDING) {
            throw biz_exception_1.BizException.conflict(biz_exception_1.ReasonCode.STORE_CHANGE_NOT_PENDING, '该申请已审核，不可作废');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.storeChangeRequest.delete({ where: { id } });
            await this.audit.record({
                operatorId: user.sub,
                operatorType: user.userType,
                operatorName: user.username,
                module: 'store',
                action: 'store:change-cancel',
                targetType: 'store_change_request',
                targetId: id,
                before: { storeId: req.storeId, changes: req.changes, status: req.status },
                after: { status: 'CANCELLED' },
                ip,
                userAgent: ua,
            }, tx);
        });
        return { id, cancelled: true };
    }
};
exports.StoreChangeService = StoreChangeService;
exports.StoreChangeService = StoreChangeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], StoreChangeService);
//# sourceMappingURL=store-change.service.js.map