import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class ApiTokenGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
