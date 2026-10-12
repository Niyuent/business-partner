import { OnModuleInit } from '@nestjs/common';
import { PointService } from './point.service';
export declare class PointsCronService implements OnModuleInit {
    private readonly points;
    private readonly logger;
    constructor(points: PointService);
    onModuleInit(): void;
    handlePointsExpire(): Promise<void>;
}
