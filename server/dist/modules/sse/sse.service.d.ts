import { OnModuleDestroy } from '@nestjs/common';
import type { Response } from 'express';
export interface SseIdentity {
    userId: number;
    merchantId: number | null;
    storeId: number | null;
    userType: string;
    username: string;
}
export interface SseTarget {
    userId?: number;
    merchantId?: number;
}
export declare class SseService implements OnModuleDestroy {
    private readonly logger;
    private readonly clients;
    private readonly tickets;
    private heartbeat?;
    private sweeper?;
    private readonly ticketTtlMs;
    constructor();
    onModuleDestroy(): void;
    createTicket(identity: SseIdentity): {
        ticket: string;
        expiresIn: number;
    };
    consumeTicket(ticket: string): SseIdentity | null;
    addClient(res: Response, identity: SseIdentity): void;
    removeClient(res: Response): void;
    broadcast(event: string, data: unknown, target?: SseTarget): number;
    stats(): {
        connections: number;
        pendingTickets: number;
        byMerchant: Record<string, number>;
    };
    private match;
    private ping;
    private sweepTickets;
    private end;
}
