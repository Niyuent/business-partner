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
exports.SseService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let SseService = class SseService {
    constructor() {
        this.logger = new common_1.Logger('SSE');
        this.clients = new Set();
        this.tickets = new Map();
        this.ticketTtlMs = Number(process.env.SSE_TICKET_TTL_MS ?? 60_000);
        const hb = Number(process.env.SSE_HEARTBEAT_MS ?? 30_000);
        this.heartbeat = setInterval(() => this.ping(), hb);
        this.sweeper = setInterval(() => this.sweepTickets(), 15_000);
    }
    onModuleDestroy() {
        if (this.heartbeat)
            clearInterval(this.heartbeat);
        if (this.sweeper)
            clearInterval(this.sweeper);
        for (const c of this.clients)
            this.end(c.res);
        this.clients.clear();
        this.tickets.clear();
    }
    createTicket(identity) {
        const ticket = (0, crypto_1.randomUUID)().replace(/-/g, '');
        this.tickets.set(ticket, { identity, expiresAt: Date.now() + this.ticketTtlMs });
        return { ticket, expiresIn: Math.floor(this.ticketTtlMs / 1000) };
    }
    consumeTicket(ticket) {
        if (!ticket)
            return null;
        const record = this.tickets.get(ticket);
        if (!record)
            return null;
        this.tickets.delete(ticket);
        if (record.expiresAt < Date.now())
            return null;
        return record.identity;
    }
    addClient(res, identity) {
        this.clients.add({ res, identity });
        this.logger.log(`用户 ${identity.username}(merchant=${identity.merchantId}) 接入，连接数 ${this.clients.size}`);
    }
    removeClient(res) {
        for (const c of this.clients) {
            if (c.res === res) {
                this.clients.delete(c);
                this.logger.log(`客户端断开，连接数 ${this.clients.size}`);
                return;
            }
        }
    }
    broadcast(event, data, target) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        let sent = 0;
        for (const client of this.clients) {
            if (!this.match(client.identity, target))
                continue;
            try {
                client.res.write(payload);
                sent++;
            }
            catch {
                this.clients.delete(client);
            }
        }
        return sent;
    }
    stats() {
        const byMerchant = {};
        for (const c of this.clients) {
            const key = String(c.identity.merchantId);
            byMerchant[key] = (byMerchant[key] ?? 0) + 1;
        }
        return { connections: this.clients.size, pendingTickets: this.tickets.size, byMerchant };
    }
    match(identity, target) {
        if (!target)
            return true;
        if (target.userId !== undefined && identity.userId !== target.userId)
            return false;
        if (target.merchantId !== undefined && identity.merchantId !== target.merchantId)
            return false;
        return true;
    }
    ping() {
        for (const client of this.clients) {
            try {
                client.res.write(': ping\n\n');
            }
            catch {
                this.clients.delete(client);
            }
        }
    }
    sweepTickets() {
        const now = Date.now();
        for (const [ticket, record] of this.tickets) {
            if (record.expiresAt < now)
                this.tickets.delete(ticket);
        }
    }
    end(res) {
        try {
            res.end();
        }
        catch {
        }
    }
};
exports.SseService = SseService;
exports.SseService = SseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], SseService);
//# sourceMappingURL=sse.service.js.map