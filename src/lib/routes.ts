/**
 * 路由配置和工具函数
 * 统一管理路由模式，避免硬编码路径判断
 */

/**
 * 路由模式定义
 */
export const RoutePatterns = {
  /** 首页 */
  HOME: '/',
  
  /** 登录页 */
  LOGIN: '/login',
  
  /** 标签列表页 */
  TAGS: '/tags',
  
  /** 标签详情页 */
  TAG_DETAIL: '/tags/[tag]',
  
  /** 归档页 */
  ARCHIVES: '/archives',
  
  /** 文章详情页 - 匹配格式: /20XX/MM/DD/title */
  POST_DETAIL: /^\/20\d{2}\/\d{2}\/\d{2}\/.+$/,
  
  /** 管理后台首页 */
  ADMIN_HOME: '/c',
  
  /** 编辑文章页 */
  EDIT_POST: /^\/c\/edit\/(new|\d+)$/,
  
  /** 用户信息页 */
  USER_INFO: '/c/user/info',
} as const;

/**
 * 路由类型
 */
export type RoutePattern = typeof RoutePatterns[keyof typeof RoutePatterns];

/**
 * 判断路径是否匹配路由模式
 * @param pathname 当前路径
 * @param pattern 路由模式（字符串或正则表达式）
 * @returns 是否匹配
 */
export function matchRoute(pathname: string, pattern: string | RegExp): boolean {
  if (typeof pattern === 'string') {
    return pathname === pattern;
  }
  return pattern.test(pathname);
}

/**
 * 判断是否为文章详情页
 * @param pathname 当前路径
 * @returns 是否为文章详情页
 */
export function isPostDetailPage(pathname: string): boolean {
  return matchRoute(pathname, RoutePatterns.POST_DETAIL);
}

/**
 * 判断是否为编辑文章页
 * @param pathname 当前路径
 * @returns 是否为编辑文章页
 */
export function isEditPostPage(pathname: string): boolean {
  return matchRoute(pathname, RoutePatterns.EDIT_POST);
}

/**
 * 从文章详情页路径中提取参数
 * @param pathname 路径，如 '/2024/12/25/my-post'
 * @returns 解析后的参数，如果不匹配返回 null
 */
export function parsePostDetailPath(pathname: string): {
  year: string;
  month: string;
  date: string;
  title: string;
} | null {
  const match = pathname.match(/^\/(\d{4})\/(\d{2})\/(\d{2})\/(.+)$/);
  
  if (!match) {
    return null;
  }
  
  return {
    year: match[1],
    month: match[2],
    date: match[3],
    title: decodeURIComponent(match[4]),
  };
}

/**
 * 生成文章详情页路径
 * @param year 年份
 * @param month 月份
 * @param date 日期
 * @param title 标题
 * @returns 完整路径
 */
export function buildPostDetailPath(
  year: string | number,
  month: string | number,
  date: string | number,
  title: string
): string {
  const yearStr = String(year).padStart(4, '0');
  const monthStr = String(month).padStart(2, '0');
  const dateStr = String(date).padStart(2, '0');
  const encodedTitle = encodeURIComponent(title);
  
  return `/${yearStr}/${monthStr}/${dateStr}/${encodedTitle}`;
}

/**
 * 生成编辑文章页路径
 * @param postId 文章ID，传入 'new' 表示创建新文章
 * @returns 编辑页路径
 */
export function buildEditPostPath(postId: number | 'new'): string {
  return `/c/edit/${postId}`;
}

