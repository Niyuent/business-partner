import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { ElMessage } from 'element-plus';
import type { ApiResponse } from '@/types/api';

/**
 * ⚠️ 本项目自 S1.4 起**彻底关闭前端 Mock**：
 *  - 这里不再 import / 安装任何 mock adapter（`src/mock/**` 已从构建链路中移除，不会被打包）；
 *  - 所有请求直接打到 `VITE_API_BASE`（默认 `/api/v1`），由 Nginx 反代到 NestJS。
 * 验收方式：DevTools → Network，请求 URL 必须是 `/api/v1/...` 且响应体带 `code/message/data/traceId`，
 * 不允许出现 `Mock 未实现接口` 之类的响应。
 */
const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api/v1',
  timeout: 15000,
});

request.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.message || error.message || '请求失败';
    if (status === 401) {
      localStorage.removeItem('token');
      ElMessage.error('登录已失效，请重新登录');
      setTimeout(() => (window.location.href = '/login'), 500);
    } else {
      ElMessage.error(message);
    }
    return Promise.reject(error);
  },
);

/** 业务请求：自动解包 data，失败时抛出后端 message（含 reasonCode） */
export async function http<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await request.request<unknown, { data: ApiResponse<T> }>(config);
  const body = res.data;
  if (body.code >= 200 && body.code < 300) {
    return body.data as T;
  }
  ElMessage.error(body.message || '请求失败');
  throw new Error(body.message || '请求失败');
}

export default request;
