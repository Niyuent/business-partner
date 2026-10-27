/**
 * ?????
 * - ?????????127.0.0.1???????
 * - ????/????????????? IP????? 127.0.0.1 ??????
 *
 * ????? `ipconfig` ? IPv4?? DEV_LAN_HOST ????????
 * ???? https ?????
 */
/** ??????? IP?????????????? storage ?? key=`mini_api_host` */
export const DEV_LAN_HOST = '10.5.126.81';

function isWechatDevtools() {
  try {
    return uni.getSystemInfoSync().platform === 'devtools';
  } catch {
    return false;
  }
}

function resolveHost() {
  try {
    const override = String(uni.getStorageSync('mini_api_host') || '').trim();
    if (override) return override.replace(/^https?:\/\//, '').replace(/\/$/, '');
  } catch {
    /* storage ?????? */
  }
  return isWechatDevtools() ? '127.0.0.1' : DEV_LAN_HOST;
}

function resolveApiBase() {
  return `http://${resolveHost()}/api/v1`;
}

/** ?????????????????? platform */
export const API_BASE_URL = resolveApiBase();

export function apiBaseUrl() {
  return resolveApiBase();
}

export function apiHost() {
  return resolveHost();
}

/** ??????????????? 127.0.0.1???????? IP? */
export function setApiHost(host: string) {
  const cleaned = host.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  if (!cleaned) {
    try {
      uni.removeStorageSync('mini_api_host');
    } catch {
      /* ignore */
    }
    return;
  }
  uni.setStorageSync('mini_api_host', cleaned);
}

/** ????????? /health */
export function probeApi(): Promise<{ ok: boolean; ms: number; detail: string }> {
  const started = Date.now();
  const url = `${apiBaseUrl().replace(/\/api\/v1\/?$/, '')}/api/v1/health`;
  return new Promise((resolve) => {
    uni.request({
      url,
      method: 'GET',
      timeout: 8000,
      success(res) {
        const ms = Date.now() - started;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, ms, detail: `? ${ms}ms` });
          return;
        }
        resolve({ ok: false, ms, detail: `HTTP ${res.statusCode}` });
      },
      fail(err) {
        resolve({
          ok: false,
          ms: Date.now() - started,
          detail: err.errMsg || '?????',
        });
      },
    });
  });
}

export const TOKEN_KEY = 'mini_token';
export const ROLE_KEY = 'mini_role';

const LOGIN_URL = '/pages/login/index';

export class HttpError extends Error {
  status: number;
  reasonCode?: string;
  payload?: unknown;

  constructor(status: number, message: string, reasonCode?: string, payload?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.reasonCode = reasonCode;
    this.payload = payload;
  }
}

export interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: UniApp.RequestOptions['data'];
  /** ? false ??? token??????? */
  auth?: boolean;
  /** ? false ? 401 ?????????????????? */
  redirectOn401?: boolean;
}

interface Envelope<T> {
  code?: number;
  message?: string;
  data?: T;
}

function currentRoute(): string {
  const pages = getCurrentPages();
  const last = pages[pages.length - 1] as { route?: string } | undefined;
  return last?.route ? `/${last.route}` : '';
}

function redirectToLogin() {
  uni.removeStorageSync(TOKEN_KEY);
  uni.removeStorageSync(ROLE_KEY);
  uni.removeStorageSync('mini_tabs');
  uni.removeStorageSync('mini_profile_name');
  uni.removeStorageSync('mini_avatar');
  if (currentRoute() === LOGIN_URL) return;
  uni.reLaunch({ url: LOGIN_URL });
}

/**
 * ??????? JWT??? { code, message, data }?401 ????????
 */
export function request<T>(options: RequestOptions): Promise<T> {
  const auth = options.auth !== false;
  const redirectOn401 = options.redirectOn401 !== false;
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (auth) {
    const token = uni.getStorageSync(TOKEN_KEY) as string;
    if (token) header.Authorization = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${apiBaseUrl()}${options.url.startsWith('/') ? options.url : `/${options.url}`}`,
      method: options.method ?? 'GET',
      data: options.data,
      header,
      timeout: 15000,
      success(res) {
        const status = res.statusCode || 0;
        const body = res.data as Envelope<T> | T | undefined;
        const message =
          body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
            ? body.message
            : `?????${status}?`;
        const payload = body && typeof body === 'object' && 'data' in body ? body.data : undefined;
        const reasonCode =
          payload && typeof payload === 'object' && payload && 'reasonCode' in payload
            ? String((payload as { reasonCode?: string }).reasonCode || '')
            : undefined;

        if (status === 401) {
          if (redirectOn401) redirectToLogin();
          reject(new HttpError(401, message || '?????', reasonCode, payload));
          return;
        }
        if (status < 200 || status >= 300) {
          reject(new HttpError(status, message, reasonCode, payload));
          return;
        }
        if (body && typeof body === 'object' && 'data' in body && 'code' in body) {
          resolve((body as Envelope<T>).data as T);
          return;
        }
        resolve(body as T);
      },
      fail(err) {
        reject(new HttpError(0, err.errMsg || '?????'));
      },
    });
  });
}

export function isUnimplemented(error: unknown): boolean {
  if (!(error instanceof HttpError)) return false;
  return error.status === 404 || error.status === 501;
}
