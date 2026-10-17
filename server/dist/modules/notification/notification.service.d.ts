import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit-log/audit.service';
import { JwtPayload } from '../auth/jwt-payload';
import { QueryNotificationDto, QuerySentNotificationDto, SendNotificationDto } from './dto/notification.dto';
export declare class NotificationService {
    private readonly prisma;
    private readonly audit;
    private readonly logger;
    constructor(prisma: PrismaService, audit: AuditService);
    private receiverWhere;
    private unreadWhere;
    private withReadState;
    private readInclude;
    private senderMerchantScope;
    private requireIds;
    private resolveReceivers;
    list(query: QueryNotificationDto, user: JwtPayload): Promise<{
        list: (Omit<{
            reads: {
                readAt: Date;
            }[];
        } & {
            level: import(".prisma/client").$Enums.NotifyLevel;
            type: import(".prisma/client").$Enums.NotificationType;
            title: string;
            id: number;
            createdAt: Date;
            content: string;
            readStatus: import(".prisma/client").$Enums.ReadStatus;
            receiverType: import(".prisma/client").$Enums.ReceiverType;
            receiverId: number;
            bizType: string | null;
            bizId: number | null;
            senderId: number | null;
            sendBatchId: string | null;
            readAt: Date | null;
        }, "reads"> & {
            readStatus: "UNREAD" | "READ";
            readAt: Date;
            alreadyRead: boolean;
        })[];
        total: number;
        page: number;
        pageSize: number;
        unreadCount: number;
    }>;
    getUnreadCount(user: JwtPayload): Promise<number>;
    unreadCount(user: JwtPayload): Promise<{
        unreadCount: number;
    }>;
    markRead(id: number, user: JwtPayload): Promise<{
        alreadyRead: boolean;
        level: import(".prisma/client").$Enums.NotifyLevel;
        type: import(".prisma/client").$Enums.NotificationType;
        title: string;
        id: number;
        createdAt: Date;
        content: string;
        readStatus: "UNREAD" | "READ";
        receiverType: import(".prisma/client").$Enums.ReceiverType;
        receiverId: number;
        bizType: string | null;
        bizId: number | null;
        senderId: number | null;
        sendBatchId: string | null;
        readAt: Date;
    }>;
    markAllRead(user: JwtPayload): Promise<{
        updated: number;
    }>;
    send(dto: SendNotificationDto, user: JwtPayload, ip?: string, ua?: string): Promise<{
        count: number;
        receiverType: import(".prisma/client").$Enums.ReceiverType;
        receiverIds: number[];
        type: import(".prisma/client").$Enums.NotificationType;
        level: import(".prisma/client").$Enums.NotifyLevel;
        title: string;
        sendBatchId: `${string}-${string}-${string}-${string}-${string}`;
    }>;
    listSent(query: QuerySentNotificationDto, user: JwtPayload): Promise<{
        list: {
            sendBatchId: string;
            title: string;
            content: string;
            type: string;
            level: string;
            createdAt: Date;
            receiverCount: number;
            receiverTypeCount: number;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    targets(user: JwtPayload): Promise<{
        merchants: {
            code: string;
            id: number;
            name: string;
        }[];
        stores: {
            code: string;
            merchantId: number;
            id: number;
            name: string;
        }[];
    }>;
    batchReceivers(sendBatchId: string, user: JwtPayload): Promise<{
        sendBatchId: string;
        receivers: ({
            receiverType: "STORE";
            receiverId: number;
            name: string;
            code: string;
            merchantId: number;
        } | {
            receiverType: "MERCHANT" | "USER";
            receiverId: number;
            name: string;
            code: string;
            merchantId: any;
        })[];
    }>;
}
