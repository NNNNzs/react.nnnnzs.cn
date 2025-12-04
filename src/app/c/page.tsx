/**
 * 管理后台首页
 * 默认重定向到 /c/post 页面
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 默认页面组件，重定向到文章管理页面
 */
export default function CPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/c/post');
  }, [router]);

  return null;
}
