export interface UploadedFileLike {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}
export declare class UploadService {
    private readonly logger;
    private readonly root;
    constructor();
    save(file: UploadedFileLike): {
        url: string;
        filename: string;
        size: number;
        mimetype: string;
    };
}
