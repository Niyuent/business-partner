import { Injectable, Logger } from '@nestjs/common';
import { BizException, ReasonCode } from '../../common/exceptions/biz.exception';

export interface WxSession {
  openid: string;
  unionid: string | null;
}

/**
 * 微信 code2session（S5.1）
 *
 * - 配置了 `WX_APPID` + `WX_SECRET`（且未开 `WX_MOCK`）→ 调真实 `sns/jscode2session`；
 * - 未配置（本地 / 自动化验收）→ **确定性模拟**：`openid = dev_openid_<code>`、`unionid = dev_unionid_<code>`，
 *   口径与真实链路一致（code → openid → unionid），便于走通完整登录而无需微信凭据。
 */
@Injectable()
export class WxService {
  private readonly logger = new Logger('Wx');
  private readonly appid = process.env.WX_APPID ?? '';
  private readonly secret = process.env.WX_SECRET ?? '';

  private get mock(): boolean {
    return process.env.WX_MOCK === 'true' || !this.appid || !this.secret;
  }

  async code2session(code: string): Promise<WxSession> {
    if (this.mock) {
      this.logger.warn(`[WX_MOCK] code2session 模拟登录：code=${code}`);
      return { openid: `dev_openid_${code}`, unionid: `dev_unionid_${code}` };
    }

    const url =
      'https://api.weixin.qq.com/sns/jscode2session' +
      `?appid=${encodeURIComponent(this.appid)}&secret=${encodeURIComponent(this.secret)}` +
      `&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;

    let j: { openid?: string; unionid?: string; errcode?: number; errmsg?: string };
    try {
      const res = await fetch(url);
      j = (await res.json()) as typeof j;
    } catch (e) {
      throw BizException.unauthorized(ReasonCode.INVALID_CREDENTIALS, `微信登录服务不可用：${(e as Error).message}`);
    }
    if (j.errcode || !j.openid) {
      throw BizException.unauthorized(ReasonCode.INVALID_CREDENTIALS, `微信登录失败：${j.errmsg ?? 'unknown'}`);
    }
    return { openid: j.openid, unionid: j.unionid ?? null };
  }
}
