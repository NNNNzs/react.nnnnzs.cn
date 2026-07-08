"use client";

import { useEffect } from "react";

/**
 * 自动给容器内所有 `<a>` 加 target="_blank" rel="noopener noreferrer"。
 *
 * 流式 Markdown 渲染会持续增删 DOM 节点，用 MutationObserver 监听容器变化，
 * 确保后渲染出来的链接也始终在新标签页打开（避免在编辑器/对话页内跳转丢失上下文）。
 *
 * @param containerRef 容器 ref
 * @param deps 重新绑定观察的依赖（通常是消息列表 / 内容）
 */
export function useExternalLinks(
  containerRef: React.RefObject<HTMLElement | null>,
  deps: React.DependencyList = [],
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const markLinks = () => {
      const links = container.querySelectorAll("a");
      links.forEach((link) => {
        if (!link.hasAttribute("target")) {
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
        }
      });
    };

    markLinks();

    const observer = new MutationObserver(markLinks);
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
