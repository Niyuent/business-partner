import { PageQueryDto } from './merchant.dto';
export declare class CreateApplicationDto {
    name: string;
    contactName: string;
    contactPhone: string;
    licenseNo: string;
    province?: string;
    city?: string;
    district?: string;
    address?: string;
    licenseImages?: string[];
    settleContact?: string;
}
export declare class QueryApplicationsDto extends PageQueryDto {
    status?: string;
}
export declare class ApproveApplicationDto {
    auditRemark?: string;
    createAccount?: boolean;
}
export declare class RejectApplicationDto {
    auditRemark: string;
}
