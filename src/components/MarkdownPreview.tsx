/**
 * Markdown 预览组件（客户端组件）
 * 用于在文章详情页显示 Markdown 内容
 */
"use client";

import React, { useMemo } from "react";
import { MdPreview, MdCatalog } from "md-editor-rt";
import "md-editor-rt/lib/preview.css";

interface MarkdownPreviewProps {
  /**
   * Markdown 内容
   */
  content: string;
  /**
   * 是否显示目录
   */
  showCatalog?: boolean;
}

/**
 * Markdown 预览组件
 * 使用 md-editor-rt 库渲染 Markdown 内容
 */
export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  // 生成唯一的 editorId
  const editorId = useMemo(() => `preview-${Date.now()}`, []);

  return (
    <div className="markdown-preview-wrapper">
      <MdPreview editorId={editorId} modelValue={content} />
    </div>
  );
}
