/**
 * 首页 - 文章列表
 * 参考 nnnnzs.cn/pages/index.vue 的设计
 */

import { getPostList } from "@/services/post";
import { getCollectionList } from "@/services/collection";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import HomePageContainer from "@/components/HomePageContainer";
import Footer from "@/components/Footer";
import type { BookshelfCollection } from "@/components/cyberpunk/furniture/types";
import { homepageSeoCopy } from "@/config/site-copy/home";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.nnnnzs.cn").replace(/\/$/, "");

export const metadata: Metadata = {
  title: homepageSeoCopy.title,
  description: homepageSeoCopy.description,
  alternates: {
    canonical: SITE_URL,
  },
  authors: [{ name: homepageSeoCopy.siteName, url: "https://github.com/NNNNzs" }],
  creator: homepageSeoCopy.siteName,
  publisher: homepageSeoCopy.siteName,
  category: "technology",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: SITE_URL,
    siteName: homepageSeoCopy.siteName,
    title: homepageSeoCopy.title,
    description: homepageSeoCopy.description,
  },
  twitter: {
    card: "summary",
    title: homepageSeoCopy.title,
    description: homepageSeoCopy.description,
  },
};

const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: homepageSeoCopy.siteName,
  alternateName: "NNNNzs 博客",
  description: homepageSeoCopy.description,
  inLanguage: "zh-CN",
  publisher: {
    "@type": "Person",
    "@id": `${SITE_URL}/#author`,
    name: homepageSeoCopy.siteName,
    url: SITE_URL,
    sameAs: ["https://github.com/NNNNzs"],
  },
};

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

const getCachedCollections = unstable_cache(
  async (): Promise<BookshelfCollection[]> => {
    const result = await getCollectionList({
      pageNum: 1,
      pageSize: 20,
      status: 1,
    });
    return result.record.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      articleCount: c.article_count,
      cover: c.cover,
      background: c.background,
      color: c.color,
    }));
  },
  ['home', 'collection-list'],
  {
    revalidate: 3600,
    tags: ['collections'],
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
  const collections = await getCachedCollections();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteStructuredData).replace(/</g, "\\u003c"),
        }}
      />
      <HomePageContainer
        posts={record}
        total={total}
        currentPageNum={validPageNum}
        collections={collections}
      />
      <Footer />
    </>
  );
}
