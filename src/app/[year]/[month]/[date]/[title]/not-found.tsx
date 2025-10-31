/**
 * 文章未找到页面
 */

import React from 'react';
import Link from 'next/link';
import { Button } from 'antd';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold text-gray-900 dark:text-white">
          404
        </h1>
        <h2 className="mb-4 text-2xl font-semibold text-gray-700 dark:text-gray-300">
          文章不存在
        </h2>
        <p className="mb-8 text-gray-500 dark:text-gray-400">
          抱歉，您访问的文章不存在或已被删除
        </p>
        <Link href="/">
          <Button type="primary" size="large">
            返回首页
          </Button>
        </Link>
      </div>
    </div>
  );
}

