/**
 * Markdown 预览组件（客户端组件）
 * 用于在文章详情页显示 Markdown 内容
 */
"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { MdPreview, MdPreviewProps, MdCatalog } from "md-editor-rt";
import "md-editor-rt/lib/preview.css";

interface MarkdownPreviewProps extends MdPreviewProps {
  /**
   * Markdown 内容
   */
  content: string;

  showMdCatalog?: boolean;
  /**
   * 是否显示目录
   */
  showCatalog?: boolean;
}

/**
 * 基于内容生成稳定的哈希值
 * 用于生成唯一的 editorId，确保服务端和客户端使用相同的 ID
 */
function generateStableId(content: string): string {
  // 使用内容的简单哈希函数生成稳定 ID
  let hash = 0;
  const str = content.slice(0, 100); // 只使用前100个字符，提高性能
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 转换为32位整数
  }
  // 转换为正数并转为36进制字符串
  return `preview-${Math.abs(hash).toString(36)}`;
}

/**
 * 获取 Markdown 内容中的标题数量
 */
function hasHeadings(content: string): boolean {
  // 检查是否存在 Markdown 标题（# ## ### 等）
  const headingRegex = /^(#{1,6})\s+.+$/gm;
  return headingRegex.test(content);
}

/**
 * Markdown 预览组件
 * 使用 md-editor-rt 库渲染 Markdown 内容
 */
export default function MarkdownPreview({
  content,
  showMdCatalog = false,
  ...props
}: MarkdownPreviewProps) {
  // 基于内容生成稳定的 editorId，确保服务端和客户端使用相同的 ID
  const editorId = useMemo(() => generateStableId(content), [content]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [hasCatalog, setHasCatalog] = useState(false);

  // 检查是否有目录
  useEffect(() => {
    if (showMdCatalog) {
      setHasCatalog(hasHeadings(content));
    }
  }, [content, showMdCatalog]);

  return (
    <div ref={wrapperRef} className="markdown-preview-wrapper relative">
      <MdPreview editorId={editorId} modelValue={content} {...props} />
      {showMdCatalog && hasCatalog && (
        <aside
          className="
            fixed top-1/2 -translate-y-1/2
            h-auto max-h-[70vh] overflow-y-auto
            w-auto min-w-[180px] max-w-[280px]
            hidden xl:block
            bg-white/80 dark:bg-gray-900/80
            backdrop-blur-sm
            rounded-lg shadow-lg
            p-4
            border border-gray-200/50 dark:border-gray-700/50
          "
          style={{
            // 使用 calc 计算位置：距离视口左边 16px
            // 在大屏幕上会显示在内容左侧
            left: 'max(16px, calc((100vw - 896px) / 2 - 300px))',
          }}
        >
          <MdCatalog
            editorId={editorId}
            scrollElement="html"
            className="w-full h-auto text-sm"
          />
        </aside>
      )}
    </div>
  );
}
