/**
 * Markdown 预览组件（客户端组件）
 * 用于在文章详情页显示 Markdown 内容
 */
"use client";

import { useEffect, useRef, useMemo } from "react";
import { MdPreview } from "md-editor-rt";
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
 * 基于内容生成稳定的哈希值
 * 用于生成唯一的 editorId，确保服务端和客户端使用相同的 ID
 */
function generateStableId(content: string): string {
  // 使用内容的简单哈希函数生成稳定 ID
  let hash = 0;
  const str = content.slice(0, 100); // 只使用前100个字符，提高性能
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  // 转换为正数并转为36进制字符串
  return `preview-${Math.abs(hash).toString(36)}`;
}

/**
 * Markdown 预览组件
 * 使用 md-editor-rt 库渲染 Markdown 内容
 */
export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  // 基于内容生成稳定的 editorId，确保服务端和客户端使用相同的 ID
  const editorId = useMemo(() => generateStableId(content), [content]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  /**
   * 移除代码块的 sticky 吸附功能
   */
  useEffect(() => {
    if (!wrapperRef.current) return;

    // 查找所有代码块
    const codeBlocks = wrapperRef.current.querySelectorAll("pre");

    codeBlocks.forEach((pre) => {
      // 移除 sticky 或 fixed 定位
      const htmlPre = pre as HTMLElement;
      const computedStyle = window.getComputedStyle(htmlPre);

      if (
        computedStyle.position === "sticky" ||
        computedStyle.position === "fixed"
      ) {
        htmlPre.style.position = "relative";
        htmlPre.style.top = "auto";
      }
    });

    // 使用 MutationObserver 监听动态添加的代码块
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            const preElements = element.querySelectorAll?.("pre") || [];

            preElements.forEach((pre) => {
              const htmlPre = pre as HTMLElement;
              const computedStyle = window.getComputedStyle(htmlPre);

              if (
                computedStyle.position === "sticky" ||
                computedStyle.position === "fixed"
              ) {
                htmlPre.style.position = "relative";
                htmlPre.style.top = "auto";
              }
            });
          }
        });
      });
    });

    observer.observe(wrapperRef.current, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [content]);

  return (
    <div ref={wrapperRef} className="markdown-preview-wrapper">
      <MdPreview editorId={editorId} modelValue={content} />
    </div>
  );
}
