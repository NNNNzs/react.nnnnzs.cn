"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { Select, Spin, Tag } from "antd";

interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface PostListResult {
  record: BlogSourcePost[];
}

export interface BlogSourcePost {
  id: number;
  title: string | null;
  tags: string[];
  description: string | null;
}

interface BlogSourceSelectorProps {
  value?: number | null;
  onChange?: (value: number | undefined) => void;
  onSelect?: (post: BlogSourcePost) => void;
  disabled?: boolean;
}

async function requestPosts(query: string, signal: AbortSignal): Promise<BlogSourcePost[]> {
  const params = new URLSearchParams({ pageNum: "1", pageSize: "12", hide: "0" });
  if (query.trim()) params.set("query", query.trim());

  const response = await fetch(`/api/post/list?${params.toString()}`, {
    cache: "no-store",
    signal,
  });
  const payload = await response.json() as ApiResponse<PostListResult>;
  if (!response.ok || !payload.status) throw new Error(payload.message || "搜索博客失败");
  return payload.data.record;
}

async function requestPost(id: number, signal: AbortSignal): Promise<BlogSourcePost> {
  const response = await fetch(`/api/post/${id}`, { cache: "no-store", signal });
  const payload = await response.json() as ApiResponse<BlogSourcePost>;
  if (!response.ok || !payload.status) throw new Error(payload.message || "获取博客失败");
  return payload.data;
}

/**
 * 内容创作表单的博客来源选择器。
 * 文章 ID 是表单值；标题、标签、描述仅用于帮助用户确认来源，不会覆盖选题内容。
 */
export function BlogSourceSelector({ value, onChange, onSelect, disabled }: BlogSourceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [posts, setPosts] = useState<BlogSourcePost[]>([]);
  const [selectedPost, setSelectedPost] = useState<BlogSourcePost | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void requestPosts(deferredQuery, controller.signal)
        .then((result) => setPosts(result))
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          console.error("[BlogSourceSelector] 搜索博客失败:", error);
          setPosts([]);
        })
        .finally(() => setLoading(false));
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [deferredQuery, open]);

  useEffect(() => {
    if (!value || selectedPost?.id === value) return;
    const controller = new AbortController();
    void requestPost(value, controller.signal)
      .then((post) => setSelectedPost(post))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("[BlogSourceSelector] 获取来源博客失败:", error);
      });
    return () => controller.abort();
  }, [selectedPost?.id, value]);

  const handleChange = (postId: number | undefined) => {
    onChange?.(postId);
    if (postId === undefined) {
      setSelectedPost(null);
      return;
    }
    const post = posts.find((item) => item.id === postId);
    if (post) {
      setSelectedPost(post);
      onSelect?.(post);
    }
  };

  return (
    <div className="space-y-2">
      <Select
        value={value ?? undefined}
        allowClear
        showSearch={{ filterOption: false, onSearch: setQuery }}
        placeholder="搜索博客标题或正文后选择"
        loading={loading}
        disabled={disabled}
        onOpenChange={setOpen}
        onChange={handleChange}
        notFoundContent={loading ? <Spin size="small" /> : "没有匹配的博客"}
        options={posts.map((post) => ({
          value: post.id,
          label: <BlogPostOption post={post} />,
        }))}
        className="w-full"
      />
      {selectedPost ? <BlogPostPreview post={selectedPost} /> : null}
    </div>
  );
}

function BlogPostOption({ post }: { post: BlogSourcePost }) {
  return (
    <div className="py-1">
      <div className="line-clamp-1 text-sm font-medium text-slate-900">#{post.id} {post.title || "未命名文章"}</div>
      {post.description ? <div className="mt-1 line-clamp-1 text-xs text-slate-500">{post.description}</div> : null}
      {post.tags.length ? <div className="mt-1.5 flex flex-wrap gap-1">{post.tags.slice(0, 4).map((tag) => <Tag key={tag}>{tag}</Tag>)}</div> : null}
    </div>
  );
}

function BlogPostPreview({ post }: { post: BlogSourcePost }) {
  return (
    <div className="rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2">
      <div className="text-xs font-medium text-blue-800">已关联博客 #{post.id} · {post.title || "未命名文章"}</div>
      {post.description ? <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{post.description}</div> : null}
      {post.tags.length ? <div className="mt-2 flex flex-wrap gap-1">{post.tags.map((tag) => <Tag key={tag} color="blue">{tag}</Tag>)}</div> : null}
    </div>
  );
}
