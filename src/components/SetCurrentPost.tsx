/**
 * 设置当前文章信息的客户端组件
 * 在文章详情页中使用，将服务端获取的文章信息传递给 Context
 */

"use client";

import { useEffect } from "react";
import { useCurrentPost } from "@/contexts/CurrentPostContext";
import type { Post } from "@/types";

interface SetCurrentPostProps {
  post: Post | null;
}

/**
 * 设置当前文章信息组件
 * 在文章详情页中使用，将文章信息设置到 Context 中
 */
export default function SetCurrentPost({ post }: SetCurrentPostProps) {
  const { setCurrentPost } = useCurrentPost();

  useEffect(() => {
    setCurrentPost(post);

    // 组件卸载时清空当前文章信息
    return () => {
      setCurrentPost(null);
    };
  }, [post, setCurrentPost]);

  // 此组件不渲染任何内容
  return null;
}

