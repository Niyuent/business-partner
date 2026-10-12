"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
const ALLOWED_MIME = new Map([
    ['image/jpeg', '.jpg'],
    ['image/png', '.png'],
    ['image/webp', '.webp'],
    ['application/pdf', '.pdf'],
]);
function sniffMime(buf) {
    const startsWith = (...bytes) => buf.length >= bytes.length && bytes.every((b, i) => buf[i] === b);
    if (startsWith(0x89, 0x50, 0x4e, 0x47))
        return 'image/png';
    if (startsWith(0xff, 0xd8, 0xff))
        return 'image/jpeg';
    if (startsWith(0x25, 0x50, 0x44, 0x46))
        return 'application/pdf';
    if (buf.length >= 12 &&
        buf.toString('ascii', 0, 4) === 'RIFF' &&
        buf.toString('ascii', 8, 12) === 'WEBP') {
        return 'image/webp';
    }
    return null;
}
let UploadService = class UploadService {
    constructor() {
        this.logger = new common_1.Logger('Upload');
        this.root = process.env.UPLOAD_DIR ?? (0, path_1.join)(process.cwd(), 'uploads');
        if (!(0, fs_1.existsSync)(this.root)) {
            (0, fs_1.mkdirSync)(this.root, { recursive: true });
        }
    }
    save(file) {
        if (!file) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.INVALID_FILE_TYPE, '缺少上传文件');
        }
        const declaredExt = ALLOWED_MIME.get(file.mimetype);
        if (!declaredExt) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.INVALID_FILE_TYPE, `不支持的文件类型：${file.mimetype}（仅允许 jpg / png / webp / pdf）`);
        }
        const realMime = sniffMime(file.buffer);
        if (!realMime) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.INVALID_FILE_TYPE, '无法识别的文件内容：文件头不符合任何受支持的类型');
        }
        if (realMime !== file.mimetype) {
            throw biz_exception_1.BizException.badRequest(biz_exception_1.ReasonCode.INVALID_FILE_TYPE, `文件内容与声明的类型不符：实为 ${realMime}，却声明为 ${file.mimetype}`);
        }
        const now = new Date();
        const year = String(now.getFullYear());
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const dir = (0, path_1.join)(this.root, year, month);
        if (!(0, fs_1.existsSync)(dir)) {
            (0, fs_1.mkdirSync)(dir, { recursive: true });
        }
        const ext = ALLOWED_MIME.get(realMime);
        const filename = `${(0, crypto_1.randomUUID)()}${ext}`;
        (0, fs_1.writeFileSync)((0, path_1.join)(dir, filename), file.buffer);
        this.logger.log(`保存上传文件 ${year}/${month}/${filename}（${file.size} bytes）`);
        return {
            url: `/uploads/${year}/${month}/${filename}`,
            filename: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
        };
    }
};
exports.UploadService = UploadService;
exports.UploadService = UploadService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], UploadService);
//# sourceMappingURL=upload.service.js.map