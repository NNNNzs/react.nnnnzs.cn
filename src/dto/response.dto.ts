/**
 * 通用响应 DTO
 */

/**
 * 创建响应成功
 */
export function successResponse<T>(data: T, message = '成功') {
  return {
    status: true,
    message,
    data,
  };
}

/**
 * 创建响应失败
 */
export function errorResponse(message = '失败', data: unknown = null) {
  return {
    status: false,
    message,
    data,
  };
}


/**
 * API 响应体
 */
export interface ResponseBody<T = unknown> {
  status: boolean;
  message: string;
  data: T;
}

