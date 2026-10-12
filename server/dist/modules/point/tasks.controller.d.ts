import { JwtPayload } from '../auth/jwt-payload';
import { PointService } from './point.service';
export declare class TasksController {
    private readonly points;
    constructor(points: PointService);
    expire(user: JwtPayload, ip: string, ua: string): Promise<import("./point.service").PointsExpireResult>;
}
