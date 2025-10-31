/**
 * 标签页
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Spin, Empty } from 'antd';
import { TagOutlined } from '@ant-design/icons';
import axios from 'axios';
import Banner from '@/components/Banner';

export default function TagsPage() {
  const [tags, setTags] = useState<[string, number][]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * 加载标签列表
   */
  const loadTags = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/post/tags');
      if (response.data.status) {
        // 按文章数量倒序排序
        const sortedTags = response.data.data.sort(
          (a: [string, number], b: [string, number]) => b[1] - a[1]
        );
        setTags(sortedTags);
      }
    } catch (error) {
      console.error('加载标签失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

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

