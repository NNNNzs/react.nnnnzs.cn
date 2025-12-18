/**
 * 路由匹配 Hook
 * 提供便捷的路由判断功能
 */

import { usePathname } from 'next/navigation';
import { RoutePatterns, matchRoute, isPostDetailPage, isEditPostPage } from '@/lib/routes';
import type { RoutePattern } from '@/lib/routes';

/**
 * 路由匹配 Hook
 * @returns 路由匹配相关的工具函数和状态
 */
export function useRouteMatch() {
  const pathname = usePathname();

  /**
   * 判断当前路径是否匹配指定路由模式
   */
  const match = (pattern: RoutePattern): boolean => {
    return matchRoute(pathname, pattern);
  };

  /**
   * 判断是否为首页
   */
  const isHome = match(RoutePatterns.HOME);

  /**
   * 判断是否为登录页
   */
  const isLogin = match(RoutePatterns.LOGIN);

  /**
   * 判断是否为标签页
   */
  const isTags = match(RoutePatterns.TAGS);

  /**
   * 判断是否为归档页
   */
  const isArchives = match(RoutePatterns.ARCHIVES);

  /**
   * 判断是否为文章详情页
   */
  const isPostDetail = isPostDetailPage(pathname);

  /**
   * 判断是否为编辑文章页
   */
  const isEditPost = isEditPostPage(pathname);

  /**
   * 判断是否为管理后台
   */
  const isAdmin = pathname.startsWith('/c');

  return {
    pathname,
    match,
    isHome,
    isLogin,
    isTags,
    isArchives,
    isPostDetail,
    isEditPost,
    isAdmin,
  };
}

