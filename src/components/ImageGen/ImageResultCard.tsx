/**
 * AI 图片生成结果展示组件
 */

"use client";

import React, { useCallback } from "react";
import { Button, Empty, Image, Space, Spin, Tag, Tooltip, message } from "antd";
import {
  DownloadOutlined,
  LinkOutlined,
  CopyOutlined,
  ExperimentOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import ImageGenJobImage, {
  type ImageGenJobSnapshot,
} from "@/components/ImageGen/ImageGenJobImage";
import { ImageOptimizationType } from "@/lib/image";

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
    jobId?: string;
    status?: string;
    resourceUri?: string;
    errorMessage?: string | null;
  } | null;
  history: ImageResultItem[];
  onHistoryClick?: (item: ImageResultItem) => void;
  onJobChange?: (job: ImageGenJobSnapshot) => void;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "排队中",
  PROCESSING: "处理中",
  SUCCESS: "成功",
  FAILED: "失败",
};

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
  onJobChange,
}: ImageResultCardProps) {
  const isTerminalLoading = loading && !meta?.jobId;
  const currentStatus = meta?.status;
  const resultImageUrl = currentStatus && currentStatus !== "SUCCESS" ? null : imageUrl;

  const handleDownload = useCallback(async () => {
    if (!resultImageUrl) return;
    try {
      const response = await fetch(resultImageUrl);
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
      window.open(resultImageUrl, "_blank");
    }
  }, [resultImageUrl]);

  const handleCopyUrl = useCallback(() => {
    if (!resultImageUrl) return;
    navigator.clipboard.writeText(resultImageUrl).then(
      () => message.success("已复制图片链接"),
      () => message.error("复制失败")
    );
  }, [resultImageUrl]);

  const handleOpenNewTab = useCallback(() => {
    if (!resultImageUrl) return;
    window.open(resultImageUrl, "_blank");
  }, [resultImageUrl]);

  return (
    <div className="space-y-4">
      {/* 当前结果 */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium">生成结果</span>
        </div>
        <div className="p-4">
          {isTerminalLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Spin size="large" />
              <p className="mt-4 text-gray-500">图片任务处理中，请稍候...</p>
              {meta?.jobId && (
                <p className="mt-2 max-w-full truncate text-xs text-gray-400">
                  Job: {meta.jobId}
                </p>
              )}
            </div>
          )}

          {!isTerminalLoading && !resultImageUrl && meta?.status === "FAILED" && (
            <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {meta.errorMessage || "图片生成失败"}
            </div>
          )}

          {!isTerminalLoading && !resultImageUrl && !meta?.jobId && meta?.status !== "FAILED" && (
            <Empty
              image={<ExperimentOutlined className="text-4xl text-gray-300" />}
              description="输入提示词并点击「生成图片」"
            />
          )}

          {!isTerminalLoading && (resultImageUrl || meta?.jobId) && (
            <div className="space-y-3">
              <div className="aspect-square overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                <ImageGenJobImage
                  job={{
                    jobId: meta?.jobId,
                    status: meta?.status as ImageGenJobSnapshot["status"],
                    imageUrl: resultImageUrl,
                    errorMessage: meta?.errorMessage,
                    elapsed: meta?.elapsed,
                    model: meta?.model,
                    size: meta?.size,
                    quality: meta?.quality,
                    resourceUri: meta?.resourceUri,
                  }}
                  imageUrl={resultImageUrl}
                  alt="生成的图片"
                  optimizationType={ImageOptimizationType.POST_LIST_COVER}
                  onJobChange={onJobChange}
                />
              </div>
              {resultImageUrl && (
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
              )}
              {meta && (
                <div className="text-xs text-gray-400 space-y-0.5 pt-2 border-t border-gray-100 dark:border-gray-700">
                  {meta.prompt && (
                    <p className="truncate" title={meta.prompt}>
                      提示词: {meta.prompt}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {meta.status && <Tag>{STATUS_LABEL[meta.status] || meta.status}</Tag>}
                    {meta.size && <Tag>{meta.size}</Tag>}
                    {meta.quality && <Tag>{meta.quality}</Tag>}
                    {meta.elapsed && (
                      <Tag icon={<ClockCircleOutlined />}>{meta.elapsed}</Tag>
                    )}
                  </div>
                  {meta.jobId && (
                    <p className="truncate" title={meta.jobId}>
                      Job: {meta.jobId}
                    </p>
                  )}
                  {meta.resourceUri && (
                    <p className="truncate" title={meta.resourceUri}>
                      Resource: {meta.resourceUri}
                    </p>
                  )}
                  {meta.errorMessage && (
                    <p className="text-red-500" title={meta.errorMessage}>
                      {meta.errorMessage}
                    </p>
                  )}
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
