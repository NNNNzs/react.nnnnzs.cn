/**
 * Axios配置
 */

import axios from 'axios';

/**
 * 配置axios默认值
 */
axios.defaults.baseURL = ''
axios.defaults.timeout = 10000;
axios.defaults.withCredentials = true;

/**
 * 请求拦截器
 */
axios.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 不需要 401 自动跳转登录页的 API 路径
 * 这些接口的 401 响应应该由调用方自行处理
 */
const SKIP_401_REDIRECT_PATHS = [
  '/api/user/info', // 获取用户信息接口，未登录时返回 401 但不应跳转
];

/**
 * 响应拦截器
 */
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // 检查是否是需要跳过 401 跳转的接口
      const requestUrl = error.config?.url || '';
      const shouldSkipRedirect = SKIP_401_REDIRECT_PATHS.some(
        (path) => requestUrl.includes(path)
      );

      // 未授权，且不在排除列表中，跳转到登录页
      if (
        !shouldSkipRedirect &&
        typeof window !== 'undefined' &&
        !window.location.pathname.includes('/login')
      ) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axios;

