import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
export declare class JwtAuthGuard implements CanActivate {
    private readonly jwt;
    private readonly reflector;
    private readonly prisma;
    constructor(jwt: JwtService, reflector: Reflector, prisma: PrismaService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
