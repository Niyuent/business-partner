import { JwtPayload } from '../auth/jwt-payload';
import { AuthorizationService } from './authorization.service';
import { QueryMeAuthorizationsDto } from './dto/authorization.dto';
export declare class MeAuthorizationController {
    private readonly authorizations;
    constructor(authorizations: AuthorizationService);
    myAuthorizations(user: JwtPayload, query: QueryMeAuthorizationsDto): Promise<{
        merchantId: number;
        merchantName: string;
        merchantType: import(".prisma/client").$Enums.MerchantType;
        canIssueMainCoupon: boolean;
        issueMainCoupon: {
            authorizationId: number;
            mainMerchantId: number;
            templateScope: string;
            allowsAllTemplates: boolean;
            templateIds: number[];
            grantedAt: Date;
        };
        authorizations: import("./authorization.service").AuthorizationView[];
    }>;
}
