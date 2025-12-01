/**
 * Markdown 预览组件（客户端组件）
 * 用于在文章详情页显示 Markdown 内容
 */
"use client";

import { useEffect, useRef, useState } from "react";
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
 * Markdown 预览组件
 * 使用 md-editor-rt 库渲染 Markdown 内容
 */
export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  // 生成唯一的 editorId
  const [editorId] = useState(
    () => `preview-${Math.random().toString(36).slice(2)}`
  );
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
