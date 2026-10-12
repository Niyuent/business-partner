import { NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
type TraceRequest = Request & {
    traceId?: string;
};
export declare class TraceMiddleware implements NestMiddleware {
    use(req: TraceRequest, res: Response, next: NextFunction): void;
}
export {};
