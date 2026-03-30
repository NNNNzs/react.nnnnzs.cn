/**
 * 首页 - 文章列表（SSG 静态生成）
 * 首页数据在构建时静态生成，加载更多通过客户端 API 调用
 */

import { getPostList } from "@/services/post";
import { unstable_cache } from "next/cache";
import HomePageContainer from "@/components/HomePageContainer";
import Footer from "@/components/Footer";

// 每页固定条数
const PAGE_SIZE = 10;

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

// 强制静态生成，避免每次请求重新执行服务端组件导致客户端 state 被重置
export const dynamic = 'force-static';

export default async function Home() {
  // 静态获取第一页数据（不再依赖 searchParams，实现 SSG）
  const { record, total } = await getCachedPosts(PAGE_SIZE);

  return (
    <>
      <HomePageContainer 
        posts={record} 
        total={total}
      />
      <Footer />
    </>
  );
}
