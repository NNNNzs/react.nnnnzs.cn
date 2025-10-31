/**
 * 通用响应 DTO
 */

/**
 * API 响应体
 */
export interface ResponseBody<T = any> {
  status: boolean;
  message: string;
  data: T;
}

