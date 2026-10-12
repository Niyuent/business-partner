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
exports.WxService = void 0;
const common_1 = require("@nestjs/common");
const biz_exception_1 = require("../../common/exceptions/biz.exception");
let WxService = class WxService {
    constructor() {
        this.logger = new common_1.Logger('Wx');
        const raw = (process.env.WX_MODE ?? '').toLowerCase();
        this.mode = raw === 'mock' ? 'mock' : 'real';
        this.appid = process.env.WX_APPID ?? '';
        this.secret = process.env.WX_SECRET ?? '';
        const isProd = process.env.NODE_ENV === 'production';
        if (this.mode === 'mock') {
            if (isProd) {
                throw new Error('[WxService] 生产环境禁止 WX_MODE=mock（模拟登录）。请配置 WX_MODE=real 且提供 WX_APPID / WX_SECRET。');
            }
            this.logger.warn('WxService 运行于 mock 模式：仅非生产环境、且仅回环/内网 IP 可用（本地开发 / 自动化验收）。');
        }
        else if (!this.appid || !this.secret) {
            throw new Error('[WxService] WX_MODE=real 时必须配置 WX_APPID / WX_SECRET，否则无法完成 code2session。');
        }
    }
    get isMock() {
        return this.mode === 'mock';
    }
    isInternalIp(ip) {
        if (!ip)
            return false;
        const v = ip.replace(/^::ffff:/, '');
        if (v === '127.0.0.1' || v === '::1' || v === 'localhost')
            return true;
        if (v.startsWith('10.') || v.startsWith('192.168.'))
            return true;
        const m = /^172\.(\d{1,3})\./.exec(v);
        if (m) {
            const n = Number(m[1]);
            if (n >= 16 && n <= 31)
                return true;
        }
        return false;
    }
    async code2session(code, ip) {
        if (this.mode === 'mock') {
            if (!this.isInternalIp(ip)) {
                throw biz_exception_1.BizException.forbidden(biz_exception_1.ReasonCode.FORBIDDEN_SCOPE, '模拟登录仅限本机/内网访问');
            }
            this.logger.warn(`[WX_MOCK] code2session 模拟登录：code=${code} ip=${ip}`);
            return { openid: `dev_openid_${code}`, unionid: `dev_unionid_${code}` };
        }
        const url = 'https://api.weixin.qq.com/sns/jscode2session' +
            `?appid=${encodeURIComponent(this.appid)}&secret=${encodeURIComponent(this.secret)}` +
            `&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
        let j;
        try {
            const res = await fetch(url);
            j = (await res.json());
        }
        catch (e) {
            throw biz_exception_1.BizException.unauthorized(biz_exception_1.ReasonCode.INVALID_CREDENTIALS, `微信登录服务不可用：${e.message}`);
        }
        if (j.errcode || !j.openid) {
            throw biz_exception_1.BizException.unauthorized(biz_exception_1.ReasonCode.INVALID_CREDENTIALS, `微信登录失败：${j.errmsg ?? 'unknown'}`);
        }
        return { openid: j.openid, unionid: j.unionid ?? null };
    }
};
exports.WxService = WxService;
exports.WxService = WxService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], WxService);
//# sourceMappingURL=wx.service.js.map