/**
 * Axios配置
 */

import axios from 'axios';

/**
 * 配置axios默认值
 */
axios.defaults.baseURL = process.env.NEXT_PUBLIC_API_URL || '';
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
 * 响应拦截器
 */
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // 未授权，可以跳转到登录页
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axios;

