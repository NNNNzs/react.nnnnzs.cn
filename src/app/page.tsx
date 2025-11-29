/**
 * 首页 - 文章列表
 * 参考 nnnnzs.cn/pages/index.vue 的设计
 */

import React from 'react';
import { getPostList } from '@/services/post';
import HomePageClient from '@/components/HomePageClient';

export const revalidate = 60;

export default async function Home() {
  const { record, total } = await getPostList({
    pageNum: 1,
    pageSize: 20,
    hide: '0',
  });

  return <HomePageClient initialPosts={record} initialTotal={total} />;
}
