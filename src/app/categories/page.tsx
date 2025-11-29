/**
 * 分类页
 */

import React from 'react';
import Link from 'next/link';
import { Empty } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import Banner from '@/components/Banner';
import { getAllCategories } from '@/services/category';

export const revalidate = 60;

export default async function CategoriesPage() {
  const categories = await getAllCategories();

  return (
    <div>
      {/* 横幅 */}
      <Banner title="分类" subtitle="按分类浏览文章" />

      {/* 分类列表 */}
      <div className="container mx-auto px-4 py-8">
        {categories.length === 0 ? (
          <Empty description="暂无分类" />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {categories.map(([category, count]) => (
              <Link
                key={category}
                href={`/categories/${encodeURIComponent(category)}`}
                className="group"
              >
                <div className="relative h-32 overflow-hidden rounded-lg bg-linear-to-br from-indigo-500 to-pink-500 p-6 shadow-md transition-all hover:shadow-xl">
                  {/* 装饰背景 */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-white blur-2xl" />
                    <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-white blur-2xl" />
                  </div>

                  {/* 内容 */}
                  <div className="relative flex h-full flex-col justify-between">
                    <div className="flex items-center space-x-2">
                      <FolderOpenOutlined className="text-2xl text-white" />
                      <h3 className="text-xl font-bold text-white line-clamp-1">
                        {category}
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white/90">
                        {count} 篇文章
                      </p>
                    </div>
                  </div>

                  {/* Hover效果 */}
                  <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

