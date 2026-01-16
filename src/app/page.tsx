/**
 * 首页 - 文章列表
 * 参考 nnnnzs.cn/pages/index.vue 的设计
 */

import React from "react";
import { getPostList } from "@/services/post";
import { unstable_cache } from "next/cache";
import HomePageContainer from "@/components/HomePageContainer";
import Footer from "@/components/Footer";

// 每页固定条数
const PAGE_SIZE = 10;

interface HomeProps {
  searchParams: Promise<{
    pageNum?: string;
  }>;
}

/**
 * 获取首页文章列表（使用 unstable_cache + 标签）
 */
const getCachedPosts = unstable_cache(
  async (pageSize: number) => {
    const result = await getPostList({
      pageNum: 1,
      pageSize,
      hide: "0",
    });
    return result;
  },
  ['home', 'post-list'],
  {
    revalidate: 3600, // 1小时后重新验证（兜底机制）
    tags: ['home', 'post-list'],
  }
);

export default async function Home({ searchParams }: HomeProps) {
  // 从 URL query 参数读取页码，默认为 1
  const params = await searchParams;
  const pageNum = params.pageNum ? parseInt(params.pageNum, 10) : 1;

  // 确保参数有效
  const validPageNum = pageNum > 0 ? pageNum : 1;

  // 计算需要加载的总条数（pageNum 页 × 每页10条）
  const totalItemsToLoad = validPageNum * PAGE_SIZE;

  // 获取所有需要的数据（从第1页到当前页）
  const { record, total } = await getCachedPosts(totalItemsToLoad);

  return (
    <>
      <HomePageContainer 
        posts={record} 
        total={total}
        currentPageNum={validPageNum}
      />
      <Footer />
    </>
  );
}
