import type { Request, Response } from 'express';
import { JwtPayload } from '../auth/jwt-payload';
import { SseService, type SseTarget } from './sse.service';
export declare class SseController {
    private readonly sse;
    constructor(sse: SseService);
    createTicket(user: JwtPayload): {
        ticket: string;
        expiresIn: number;
        connectUrl: string;
    };
    notifications(ticket: string, req: Request, res: Response): void;
    publish(body: {
        event: string;
        data?: unknown;
        target?: SseTarget;
    }): {
        sent: number;
        target: string | SseTarget;
    };
    stats(): {
        connections: number;
        pendingTickets: number;
        byMerchant: Record<string, number>;
    };
}
