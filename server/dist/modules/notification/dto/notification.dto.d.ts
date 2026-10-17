import { NotificationType, NotifyLevel, ReadStatus } from '@prisma/client';
export declare const NOTIFICATION_TARGET_TYPES: readonly ["MERCHANT", "STORE", "ALL_MERCHANTS", "ALL_STORES"];
export type NotificationTargetType = (typeof NOTIFICATION_TARGET_TYPES)[number];
export declare class SendNotificationDto {
    targetType: NotificationTargetType;
    targetIds?: number[];
    title: string;
    content: string;
    type?: NotificationType;
    level?: NotifyLevel;
}
export declare class QueryNotificationDto {
    page?: number;
    pageSize?: number;
    readStatus?: ReadStatus;
    type?: NotificationType;
}
export declare class QuerySentNotificationDto {
    page?: number;
    pageSize?: number;
    type?: NotificationType;
    keyword?: string;
}
export interface NotificationTargets {
    merchants: Array<{
        id: number;
        name: string;
        code: string | null;
    }>;
    stores: Array<{
        id: number;
        name: string;
        code: string | null;
        merchantId: number;
    }>;
}
