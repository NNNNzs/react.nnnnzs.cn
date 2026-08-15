/**
 * 文章详情页
 * 路由: /[year]/[month]/[date]/[title]/
 * 匹配原版 Nuxt.js 的路由结构
 * 服务端渲染，支持 SEO
 */

import React, { cache, Suspense } from "react";
import { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Tag } from "antd";
import {
  EyeOutlined,
  HeartOutlined,
  CalendarOutlined,
} from "@ant-design/icons";

import dayjs from "dayjs";
import { getPostByPath, getPostList, getPublicPostByTitle } from "@/services/post";

import { getCollectionsByPostId } from "@/services/collection";
import PostLikeButton from "./PostLikeButton";
import PostVisitorTracker from "./PostVisitorTracker";
import MarkdownPreview from "@/components/MarkdownPreview";
import CommentSection from "@/components/CommentSection";
import SetCurrentPost from "@/components/SetCurrentPost";
import PostVersionHistory from "@/components/PostVersionHistory";
import ArticleCollections from "@/components/ArticleCollections";
import { formatShanghaiDateTime } from "@/lib/date-time";
import type { Post } from "@/types";
import type { PostCollectionInfo } from "@/dto/collection.dto";
import { createSeoDescription } from "@/lib/seo-content";
import { getSiteUrl, toAbsoluteSiteUrl } from "@/lib/site-url";

interface PageProps {
  params:
    | Promise<{
        year: string;
        month: string;
        date: string;
        title: string;
      }>
    | {
        year: string;
        month: string;
        date: string;
        title: string;
      };
}

/**
 * 解析 params（支持 Promise 和普通对象）
 */
async function resolveParams(params: PageProps["params"]) {
  if (params instanceof Promise) {
    return await params;
  }
  return params;
}

/**
 * 获取文章数据（直接调用 service，不使用缓存）
 * 构建时会预渲染，运行时使用 ISR
 */
function getRequestedPath(params: Awaited<PageProps["params"]>): string {
  return `/${params.year}/${params.month}/${params.date}/${params.title}`;
}

function safelyDecodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

const getPost = cache(async (path: string, rawTitle: string): Promise<Post | null> => {
  try {
    console.log("🔍 获取文章 - 文章路径:", path);
    const postByPath = await getPostByPath(path);
    if (postByPath) {
      return postByPath;
    }

    const decodedTitle = safelyDecodePath(rawTitle);
    console.log("🔍 path 查询失败，尝试通过公开标题查询:", rawTitle, 'decode', decodedTitle);
    const postByTitle = await getPublicPostByTitle(decodedTitle);
    if (postByTitle) {
      console.log("✅ 通过 title 查询成功，文章 ID:", postByTitle.id);
    }
    return postByTitle;
  } catch (error) {
    console.error("❌ 获取文章详情失败:", error);
    return null;
  }
});

/**
 * 获取文章所属合集
 * 使用 React cache 缓存
 */
const getPostCollections = cache(
  async (postId: number): Promise<PostCollectionInfo[]> => {
    try {
      return await getCollectionsByPostId(postId);
    } catch (error) {
      console.error("❌ 获取文章合集失败:", error);
      return [];
    }
  }
);

/**
 * 生成 SEO Metadata
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const resolvedParams = await resolveParams(params);
  const requestedPath = getRequestedPath(resolvedParams);
  const post = await getPost(requestedPath, resolvedParams.title);

  if (!post) {
    return {
      title: "文章不存在",
    };
  }

  const description = createSeoDescription(
    post.description,
    post.content,
    `${post.title || '文章'} - NNNNzs`,
  );

  const coverImages = post.cover ? [post.cover] : undefined;
  const canonicalUrl = toAbsoluteSiteUrl(post.path);

  return {
    title: `${post.title} | 博客`,
    description,
    alternates: { canonical: canonicalUrl },
    robots: post.seo_indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
    keywords:
      Array.isArray(post.tags) && post.tags.length > 0
        ? post.tags.join(",")
        : undefined,
    openGraph: {
      title: post.title || undefined,
      description,
      type: "article",
      publishedTime: post.date ? String(post.date) : undefined,
      modifiedTime: post.updated ? String(post.updated) : undefined,
      images: coverImages,
      tags:
        Array.isArray(post.tags) && post.tags.length > 0
          ? post.tags
          : undefined,
      url: canonicalUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title || undefined,
      description,
      images: coverImages,
    },
  };
}

/**
 * 页面组件（服务端渲染）
 */
export default async function PostDetail({ params }: PageProps) {
    // 解析 params
    const resolvedParams = await resolveParams(params);
    const requestedPath = getRequestedPath(resolvedParams);
    const post = await getPost(requestedPath, resolvedParams.title);

    if (!post) {
      // console.log("❌ 文章不存在，调用 notFound()");
      notFound();
    }

    if (safelyDecodePath(requestedPath) !== safelyDecodePath(post.path)) {
      permanentRedirect(post.path);
    }

    // 获取文章所属合集
    const collections = await getPostCollections(post.id);
    const description = createSeoDescription(
      post.description,
      post.content,
      `${post.title || '文章'} - NNNNzs`,
    );
    const canonicalUrl = toAbsoluteSiteUrl(post.path);
    const siteUrl = getSiteUrl();
    const breadcrumbItems = [
      { "@type": "ListItem", position: 1, name: "首页", item: siteUrl },
      ...(post.category
        ? [{
            "@type": "ListItem",
            position: 2,
            name: post.category,
            item: toAbsoluteSiteUrl(`/categories/${encodeURIComponent(post.category)}`),
          }]
        : []),
      {
        "@type": "ListItem",
        position: post.category ? 3 : 2,
        name: post.title || "文章",
        item: canonicalUrl,
      },
    ];

    return (
      <>
        <meta
          name="post-cache-debug"
          data-post-id={post.id}
          data-post-updated-at={formatShanghaiDateTime(post.updated)}
        />
        {/* 将文章信息传递给 Header 组件 */}
        <SetCurrentPost post={post} />

        {/* 结构化数据（JSON-LD） */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              "@id": `${canonicalUrl}#article`,
              url: canonicalUrl,
              mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
              headline: post.title,
              description,
              image: post.cover,
              datePublished: post.date,
              dateModified: post.updated,
              author: {
                "@type": "Person",
                name: "nnnnzs",
                url: "https://github.com/NNNNzs",
              },
              publisher: {
                "@type": "Person",
                name: "NNNNzs",
                url: siteUrl,
              },
              isPartOf: {
                "@type": "Blog",
                name: "NNNNzs",
                url: siteUrl,
              },
              keywords:
                Array.isArray(post.tags) && post.tags.length > 0
                  ? post.tags.join(",")
                  : undefined,
            }).replace(/</g, "\\u003c"),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: breadcrumbItems,
            }).replace(/</g, "\\u003c"),
          }}
        />

        <article className="mx-auto max-w-4xl px-4 py-8 relative">
          {/* 文章头部 */}
          <header className="mb-8 border-b pb-8">
            <h1 className="mb-4 text-4xl font-bold text-slate-950 dark:text-white">
              {post.title}
            </h1>

            {/* 元信息 */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center">
                <CalendarOutlined className="mr-1" />
                {dayjs(post.date).format("YYYY年MM月DD日")}
              </span>
              <span className="flex items-center">
                <EyeOutlined className="mr-1" />
                <PostVisitorTracker
                  postId={post.id}
                  initialCount={post.visitors || 0}
                />
              </span>
              <span className="flex items-center">
                <HeartOutlined className="mr-1" />
                {post.likes || 0} 人喜欢
              </span>
            </div>

            {/* 标签 */}
            {Array.isArray(post.tags) && post.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.map((tag, index) => (
                  <Tag key={index} color="blue">
                    {tag}
                  </Tag>
                ))}
              </div>
            )}
          </header>

          {/* 所属合集 */}
          {collections && collections.length > 0 && (
            <ArticleCollections collections={collections} />
          )}

          {/* 文章内容 */}
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <MarkdownPreview
              showMdCatalog={true}
              content={post.content || ""}
            />
          </div>

          {/* 点赞按钮和版本历史 */}
          <div className="mt-8 flex items-center justify-center gap-4 border-t pt-8">
            <PostLikeButton postId={post.id} initialLikes={post.likes || 0} />
            <PostVersionHistory postId={post.id} />
          </div>
        </article>

        {/* 评论区 */}
        <div className="mt-12 px-4">
          <Suspense
            fallback={
              <div className="text-center py-8 text-slate-500">
                加载评论中...
              </div>
            }
          >
            <CommentSection postId={post.id} />
          </Suspense>
        </div>
      </>
    );
}

export async function generateStaticParams() {
  try {
    const { record } = await getPostList({ pageNum: 1, pageSize: 10000 }); // DB 查 path

    return record.map((post) => {
      const [, year, month, date, title] = post.path!.split("/");

      return {
        year,
        month,
        date,
        title: title,
      };
    });
  } catch (error) {
    // 构建时数据库不可达时优雅降级：跳过预渲染，由 ISR 在运行时按需生成
    console.warn("⚠️ generateStaticParams: 数据库连接失败，跳过预渲染:", error);
    return [];
  }
}

// 使用 ISR (增量静态再生成)，支持按需重新验证
// 1小时后自动重新验证作为兜底机制，实际更新时通过 revalidatePath 立即清除缓存
export const revalidate = 3600;
