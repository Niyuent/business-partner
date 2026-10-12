import { UploadService, type UploadedFileLike } from './upload.service';
export declare class UploadController {
    private readonly upload;
    constructor(upload: UploadService);
    uploadFile(file: UploadedFileLike): {
        url: string;
        filename: string;
        size: number;
        mimetype: string;
    };
}
