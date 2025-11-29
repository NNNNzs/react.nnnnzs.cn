/**
 * 标签页
 */

import React from 'react';
import Link from 'next/link';
import { Empty } from 'antd';
import { TagOutlined } from '@ant-design/icons';
import Banner from '@/components/Banner';
import { getAllTags } from '@/services/tag';

export const revalidate = 60;

export default async function TagsPage() {
  const tags = await getAllTags();

  return (
    <div>
      {/* 横幅 */}
      <Banner title="标签" subtitle="按标签浏览文章" />

      {/* 标签列表 */}
      <div className="container mx-auto px-4 py-8">
        {tags.length === 0 ? (
          <Empty description="暂无标签" />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {tags.map(([tag, count]) => (
              <Link
                key={tag}
                href={`/tags/${encodeURIComponent(tag)}`}
                className="group"
              >
                <div className="relative h-32 overflow-hidden rounded-lg bg-linear-to-br from-blue-500 to-purple-600 p-6 shadow-md transition-all hover:shadow-xl">
                  {/* 装饰背景 */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-white blur-2xl" />
                    <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-white blur-2xl" />
                  </div>

                  {/* 内容 */}
                  <div className="relative flex h-full flex-col justify-between">
                    <div className="flex items-center space-x-2">
                      <TagOutlined className="text-2xl text-white" />
                      <h3 className="text-xl font-bold text-white line-clamp-1">
                        {tag}
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
