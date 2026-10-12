import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
export interface ApiResponse<T = unknown> {
    code: number;
    message: string;
    data: T | null;
    traceId: string;
}
export declare class ResponseInterceptor<T = unknown> implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
}
