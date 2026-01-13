/**
 * Markdown 预览组件（客户端组件）
 * 用于在文章详情页显示 Markdown 内容
 */
"use client";

import { useRef, useMemo } from "react";
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

  return (
    <div ref={wrapperRef} className="markdown-preview-wrapper">
      <MdPreview editorId={editorId} modelValue={content} {...props} />
      {showMdCatalog && (
        <div className="fixed left-[10%] top-[50%]  translate-y-[-50%] h-[60vh] overflow-y-auto w-[30vh]">
          <MdCatalog
            editorId={editorId}
            scrollElement="html"
            className="w-full h-auto"
          />
        </div>
      )}
    </div>
  );
}
