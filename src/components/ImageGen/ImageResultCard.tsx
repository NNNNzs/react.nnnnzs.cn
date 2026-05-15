/**
 * AI 图片生成结果展示组件
 */

"use client";

import React, { useCallback } from "react";
import { Image, Button, Space, Spin, Empty, Tag, Tooltip, message } from "antd";
import {
  DownloadOutlined,
  LinkOutlined,
  CopyOutlined,
  ExperimentOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";

interface ImageResultItem {
  id: string;
  imageUrl: string;
  prompt: string;
  mode: "generate" | "edit";
  size?: string;
  quality?: string;
  elapsed?: string;
  timestamp: number;
}

interface ImageResultCardProps {
  imageUrl: string | null;
  loading: boolean;
  meta: {
    elapsed?: string;
    model?: string;
    size?: string;
    quality?: string;
    prompt?: string;
  } | null;
  history: ImageResultItem[];
  onHistoryClick?: (item: ImageResultItem) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

export default function ImageResultCard({
  imageUrl,
  loading,
  meta,
  history,
  onHistoryClick,
}: ImageResultCardProps) {
  const handleDownload = useCallback(async () => {
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `image_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, "_blank");
    }
  }, [imageUrl]);

  const handleCopyUrl = useCallback(() => {
    if (!imageUrl) return;
    navigator.clipboard.writeText(imageUrl).then(
      () => message.success("已复制图片链接"),
      () => message.error("复制失败")
    );
  }, [imageUrl]);

  const handleOpenNewTab = useCallback(() => {
    if (!imageUrl) return;
    window.open(imageUrl, "_blank");
  }, [imageUrl]);

  return (
    <div className="space-y-4">
      {/* 当前结果 */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium">生成结果</span>
        </div>
        <div className="p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Spin size="large" />
              <p className="mt-4 text-gray-500">正在生成图片，请稍候...</p>
            </div>
          )}

          {!loading && !imageUrl && (
            <Empty
              image={<ExperimentOutlined className="text-4xl text-gray-300" />}
              description="输入提示词并点击「生成图片」"
            />
          )}

          {!loading && imageUrl && (
            <div className="space-y-3">
              <Image
                src={imageUrl}
                alt="生成的图片"
                className="w-full rounded-md"
                fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5IiBmb250LXNpemU9IjE0Ij7lm77niYfliqDovb3lpLHotKU8L3RleHQ+PC9zdmc+"
              />
              <Space wrap>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                  size="small"
                >
                  下载
                </Button>
                <Tooltip title="新标签打开">
                  <Button
                    icon={<LinkOutlined />}
                    onClick={handleOpenNewTab}
                    size="small"
                  />
                </Tooltip>
                <Tooltip title="复制图片链接">
                  <Button
                    icon={<CopyOutlined />}
                    onClick={handleCopyUrl}
                    size="small"
                  />
                </Tooltip>
              </Space>
              {meta && (
                <div className="text-xs text-gray-400 space-y-0.5 pt-2 border-t border-gray-100 dark:border-gray-700">
                  {meta.prompt && (
                    <p className="truncate" title={meta.prompt}>
                      提示词: {meta.prompt}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {meta.size && <Tag>{meta.size}</Tag>}
                    {meta.quality && <Tag>{meta.quality}</Tag>}
                    {meta.elapsed && (
                      <Tag icon={<ClockCircleOutlined />}>{meta.elapsed}</Tag>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 历史记录 */}
      {history.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm font-medium">历史记录</span>
            <span className="text-xs text-gray-400">{history.length} 条</span>
          </div>
          <div className="p-2 grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
            {history
              .slice()
              .reverse()
              .map((item) => (
                <div
                  key={item.id}
                  className="relative group cursor-pointer rounded overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-400 transition-colors"
                  onClick={() => onHistoryClick?.(item)}
                >
                  <Image
                    src={item.imageUrl}
                    alt={item.prompt.slice(0, 20)}
                    width={200}
                    height={150}
                    className="w-full object-cover"
                    preview={false}
                    style={{ aspectRatio: "4/3" }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatTime(item.timestamp)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
