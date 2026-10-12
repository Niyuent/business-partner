export declare class RateLimitService {
    private readonly logger;
    private readonly buckets;
    private checksSinceSweep;
    check(key: string, limit: number, windowMs: number): {
        remaining: number;
    };
    private sweepExpired;
}
