/**
 * 通用响应 DTO
 */

/**
 * API 响应体
 */
export interface ResponseBody<T = unknown> {
  status: boolean;
  message: string;
  data: T;
}

