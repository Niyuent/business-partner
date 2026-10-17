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
exports.NotificationService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const audit_service_1 = require("../audit-log/audit.service");
let NotificationService = class NotificationService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
        this.logger = new common_1.Logger('Notification');
    }
    async receiverWhere(user) {
        if (user.userType === 'STORE') {
            return user.storeId ? { receiverType: client_1.ReceiverType.STORE, receiverId: user.storeId } : null;
        }
        if (user.userType !== 'MERCHANT' || !user.merchantId)
            return null;
        const stores = await this.prisma.store.findMany({
            where: { merchantId: user.merchantId },
            select: { id: true },
        });
        const or = [
            { receiverType: client_1.ReceiverType.MERCHANT, receiverId: user.merchantId },
        ];
        if (stores.length) {
            or.push({ receiverType: client_1.ReceiverType.STORE, receiverId: { in: stores.map((s) => s.id) } });
        }
        return { OR: or };
    }
    unreadWhere(mine, adminUserId) {
        return { AND: [mine, { reads: { none: { adminUserId } } }] };
    }
    withReadState(row) {
        const { reads, ...rest } = row;
        const readAt = reads?.[0]?.readAt ?? null;
        return {
            ...rest,
            readStatus: readAt ? client_1.ReadStatus.READ : client_1.ReadStatus.UNREAD,
            readAt,
            alreadyRead: readAt !== null,
        };
    }
    readInclude(adminUserId) {
        return { reads: { where: { adminUserId }, select: { readAt: true } } };
    }
    async senderMerchantScope(user) {
        if (user.userType === 'PLATFORM')
            return { type: client_1.MerchantType.SUB };
        if (user.userType === 'MERCHANT' && user.merchantId) {
            const me = await this.prisma.merchant.findUnique({
                where: { id: user.merchantId },
                select: { type: true },
            });
            if (me?.type === client_1.MerchantType.MAIN)
                return { type: client_1.MerchantType.SUB, parentId: user.merchantId };
        }
        throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '通知由主体商家发布');
    }
    requireIds(dto) {
        if (!dto.targetIds?.length) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.NOTIFICATION_TARGET_REQUIRED, `targetType=${dto.targetType} 时必须传 targetIds`);
        }
        return [...new Set(dto.targetIds)];
    }
    async resolveReceivers(dto, scope) {
        if ((dto.targetType === 'ALL_MERCHANTS' || dto.targetType === 'ALL_STORES') && dto.targetIds?.length) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.NOTIFICATION_TARGET_INVALID, `targetType=${dto.targetType} 时不可传 targetIds`);
        }
        switch (dto.targetType) {
            case 'MERCHANT': {
                const ids = this.requireIds(dto);
                const rows = await this.prisma.merchant.findMany({
                    where: { AND: [scope, { id: { in: ids } }] },
                    select: { id: true },
                });
                const found = new Set(rows.map((r) => r.id));
                const missing = ids.filter((id) => !found.has(id));
                if (missing.length) {
                    throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, `以下商家不在可发布范围内：${missing.join(', ')}`);
                }
                return { receiverType: client_1.ReceiverType.MERCHANT, receiverIds: ids };
            }
            case 'STORE': {
                const ids = this.requireIds(dto);
                const rows = await this.prisma.store.findMany({
                    where: { id: { in: ids }, merchant: scope },
                    select: { id: true },
                });
                const found = new Set(rows.map((r) => r.id));
                const missing = ids.filter((id) => !found.has(id));
                if (missing.length) {
                    throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.STORE_NOT_OWNED, `以下门店不在可发布范围内：${missing.join(', ')}`);
                }
                return { receiverType: client_1.ReceiverType.STORE, receiverIds: ids };
            }
            case 'ALL_MERCHANTS': {
                const rows = await this.prisma.merchant.findMany({
                    where: { AND: [scope, { status: client_1.MerchantStatus.APPROVED }] },
                    select: { id: true },
                    orderBy: { id: 'asc' },
                });
                return { receiverType: client_1.ReceiverType.MERCHANT, receiverIds: rows.map((r) => r.id) };
            }
            case 'ALL_STORES': {
                const rows = await this.prisma.store.findMany({
                    where: {
                        status: client_1.StoreStatus.OPEN,
                        merchant: { AND: [scope, { status: client_1.MerchantStatus.APPROVED }] },
                    },
                    select: { id: true },
                    orderBy: { id: 'asc' },
                });
                return { receiverType: client_1.ReceiverType.STORE, receiverIds: rows.map((r) => r.id) };
            }
        }
    }
    async list(query, user) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const mine = await this.receiverWhere(user);
        if (!mine)
            return { list: [], total: 0, page, pageSize, unreadCount: 0 };
        const uid = user.sub;
        const where = {
            AND: [
                mine,
                query.readStatus === client_1.ReadStatus.UNREAD
                    ? { reads: { none: { adminUserId: uid } } }
                    : query.readStatus === client_1.ReadStatus.READ
                        ? { reads: { some: { adminUserId: uid } } }
                        : {},
                query.type ? { type: query.type } : {},
            ],
        };
        const [rows, total, unreadCount] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                orderBy: { id: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: this.readInclude(uid),
            }),
            this.prisma.notification.count({ where }),
            this.prisma.notification.count({ where: this.unreadWhere(mine, uid) }),
        ]);
        return { list: rows.map((r) => this.withReadState(r)), total, page, pageSize, unreadCount };
    }
    async getUnreadCount(user) {
        const mine = await this.receiverWhere(user);
        if (!mine)
            return 0;
        return this.prisma.notification.count({ where: this.unreadWhere(mine, user.sub) });
    }
    async unreadCount(user) {
        return { unreadCount: await this.getUnreadCount(user) };
    }
    async markRead(id, user) {
        const mine = await this.receiverWhere(user);
        if (!mine)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '通知不存在');
        const uid = user.sub;
        const exists = await this.prisma.notification.findFirst({
            where: { AND: [mine, { id }] },
            select: { id: true },
        });
        if (!exists)
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '通知不存在');
        const { count } = await this.prisma.notificationRead.createMany({
            data: [{ notificationId: id, adminUserId: uid }],
            skipDuplicates: true,
        });
        const row = await this.prisma.notification.findUniqueOrThrow({
            where: { id },
            include: this.readInclude(uid),
        });
        return { ...this.withReadState(row), alreadyRead: count === 0 };
    }
    async markAllRead(user) {
        const mine = await this.receiverWhere(user);
        if (!mine)
            return { updated: 0 };
        const uid = user.sub;
        const targets = await this.prisma.notification.findMany({
            where: this.unreadWhere(mine, uid),
            select: { id: true },
            orderBy: { id: 'asc' },
        });
        if (!targets.length)
            return { updated: 0 };
        let updated = 0;
        const CHUNK = 500;
        for (let i = 0; i < targets.length; i += CHUNK) {
            const { count } = await this.prisma.notificationRead.createMany({
                data: targets.slice(i, i + CHUNK).map((t) => ({ notificationId: t.id, adminUserId: uid })),
                skipDuplicates: true,
            });
            updated += count;
        }
        return { updated };
    }
    async send(dto, user, ip, ua) {
        const scope = await this.senderMerchantScope(user);
        const { receiverType, receiverIds } = await this.resolveReceivers(dto, scope);
        if (!receiverIds.length) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.NOTIFICATION_NO_RECEIVER, '没有符合条件的接收方');
        }
        const type = dto.type ?? client_1.NotificationType.SYSTEM;
        const level = dto.level ?? client_1.NotifyLevel.NORMAL;
        const sendBatchId = (0, node_crypto_1.randomUUID)();
        return this.prisma.$transaction(async (tx) => {
            const { count } = await tx.notification.createMany({
                data: receiverIds.map((receiverId) => ({
                    receiverType,
                    receiverId,
                    type,
                    level,
                    title: dto.title,
                    content: dto.content,
                    senderId: user.sub,
                    sendBatchId,
                })),
            });
            await this.audit.record({
                operatorId: user.sub,
                operatorType: user.userType,
                operatorName: user.username,
                module: 'notification',
                action: 'notification:send',
                targetType: 'notification',
                after: {
                    targetType: dto.targetType,
                    receiverType,
                    receiverIds,
                    count,
                    type,
                    level,
                    title: dto.title,
                    sendBatchId,
                },
                ip,
                userAgent: ua,
            }, tx);
            return { count, receiverType, receiverIds, type, level, title: dto.title, sendBatchId };
        });
    }
    async listSent(query, user) {
        await this.senderMerchantScope(user);
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const conds = [client_1.Prisma.sql `senderId = ${user.sub}`, client_1.Prisma.sql `sendBatchId IS NOT NULL`];
        if (query.type)
            conds.push(client_1.Prisma.sql `type = ${query.type}`);
        if (query.keyword)
            conds.push(client_1.Prisma.sql `title LIKE ${`%${query.keyword}%`}`);
        const whereSql = client_1.Prisma.join(conds, ' AND ');
        const [totalRow] = await this.prisma.$queryRaw(client_1.Prisma.sql `SELECT COUNT(DISTINCT sendBatchId) AS total FROM notifications WHERE ${whereSql}`);
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `SELECT sendBatchId,
                        MIN(title)    AS title,
                        MIN(content)  AS content,
                        MIN(type)     AS type,
                        MIN(level)    AS level,
                        MIN(createdAt) AS createdAt,
                        COUNT(*)                   AS receiverCount,
                        COUNT(DISTINCT receiverType) AS receiverTypeCount
                 FROM notifications
                 WHERE ${whereSql}
                 GROUP BY sendBatchId
                 ORDER BY MIN(createdAt) DESC, sendBatchId DESC
                 LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`);
        return {
            list: rows.map((r) => ({
                sendBatchId: r.sendBatchId,
                title: r.title,
                content: r.content,
                type: r.type,
                level: r.level,
                createdAt: r.createdAt,
                receiverCount: Number(r.receiverCount),
                receiverTypeCount: Number(r.receiverTypeCount),
            })),
            total: Number(totalRow?.total ?? 0),
            page,
            pageSize,
        };
    }
    async targets(user) {
        const scope = await this.senderMerchantScope(user);
        const LIMIT = 2000;
        const [merchants, stores] = await Promise.all([
            this.prisma.merchant.findMany({
                where: { AND: [scope, { status: client_1.MerchantStatus.APPROVED }] },
                select: { id: true, name: true, code: true },
                orderBy: { id: 'asc' },
                take: LIMIT,
            }),
            this.prisma.store.findMany({
                where: {
                    status: client_1.StoreStatus.OPEN,
                    merchant: { AND: [scope, { status: client_1.MerchantStatus.APPROVED }] },
                },
                select: { id: true, name: true, code: true, merchantId: true },
                orderBy: { id: 'asc' },
                take: LIMIT,
            }),
        ]);
        if (merchants.length >= LIMIT || stores.length >= LIMIT) {
            this.logger.warn(`targets 超过 ${LIMIT}，需要分页（merchants=${merchants.length} stores=${stores.length}）`);
        }
        return { merchants, stores };
    }
    async batchReceivers(sendBatchId, user) {
        await this.senderMerchantScope(user);
        const LIMIT = 500;
        const rows = await this.prisma.notification.findMany({
            where: { sendBatchId, senderId: user.sub },
            select: { id: true, receiverType: true, receiverId: true, createdAt: true },
            orderBy: { id: 'asc' },
            take: LIMIT,
        });
        if (!rows.length) {
            throw biz_exception_1.BizException.notFound(biz_exception_1.ReasonCode.RESOURCE_NOT_FOUND, '发送批次不存在或不属于你');
        }
        const merchantIds = [
            ...new Set(rows.filter((r) => r.receiverType === client_1.ReceiverType.MERCHANT).map((r) => r.receiverId)),
        ];
        const storeIds = [...new Set(rows.filter((r) => r.receiverType === client_1.ReceiverType.STORE).map((r) => r.receiverId))];
        const [merchants, stores] = await Promise.all([
            this.prisma.merchant.findMany({
                where: { id: { in: merchantIds } },
                select: { id: true, name: true, code: true },
            }),
            this.prisma.store.findMany({
                where: { id: { in: storeIds } },
                select: { id: true, name: true, code: true, merchantId: true },
            }),
        ]);
        const merchantMap = new Map(merchants.map((m) => [m.id, m]));
        const storeMap = new Map(stores.map((s) => [s.id, s]));
        return {
            sendBatchId,
            receivers: rows.map((r) => r.receiverType === client_1.ReceiverType.STORE
                ? {
                    receiverType: r.receiverType,
                    receiverId: r.receiverId,
                    name: storeMap.get(r.receiverId)?.name ?? `门店 #${r.receiverId}`,
                    code: storeMap.get(r.receiverId)?.code ?? null,
                    merchantId: storeMap.get(r.receiverId)?.merchantId ?? null,
                }
                : {
                    receiverType: r.receiverType,
                    receiverId: r.receiverId,
                    name: merchantMap.get(r.receiverId)?.name ?? `商家 #${r.receiverId}`,
                    code: merchantMap.get(r.receiverId)?.code ?? null,
                    merchantId: null,
                }),
        };
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], NotificationService);
//# sourceMappingURL=notification.service.js.map