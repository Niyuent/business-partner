"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitService = void 0;
const common_1 = require("@nestjs/common");
const biz_exception_1 = require("../exceptions/biz.exception");
let RateLimitService = class RateLimitService {
    constructor() {
        this.logger = new common_1.Logger('RateLimit');
        this.buckets = new Map();
        this.checksSinceSweep = 0;
    }
    check(key, limit, windowMs) {
        const now = Date.now();
        const hits = (this.buckets.get(key) ?? []).filter((t) => now - t < windowMs);
        if (hits.length >= limit) {
            this.buckets.set(key, hits);
            const retrySec = Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000));
            this.logger.warn(`限流命中 ${key}（${limit} 次 / ${windowMs}ms），请在 ${retrySec}s 后重试`);
            throw biz_exception_1.BizException.tooManyRequests(biz_exception_1.ReasonCode.RATE_LIMITED, `操作过于频繁，请在 ${Math.ceil(retrySec / 60)} 分钟后再试`);
        }
        hits.push(now);
        this.buckets.set(key, hits);
        if (++this.checksSinceSweep >= 200) {
            this.sweepExpired(windowMs);
        }
        return { remaining: limit - hits.length };
    }
    sweepExpired(windowMs) {
        this.checksSinceSweep = 0;
        const now = Date.now();
        for (const [key, hits] of this.buckets) {
            const alive = hits.filter((t) => now - t < windowMs);
            if (alive.length === 0) {
                this.buckets.delete(key);
            }
            else {
                this.buckets.set(key, alive);
            }
        }
    }
};
exports.RateLimitService = RateLimitService;
exports.RateLimitService = RateLimitService = __decorate([
    (0, common_1.Injectable)()
], RateLimitService);
//# sourceMappingURL=rate-limit.service.js.map