"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Spin } from "antd";
import { CloseCircleOutlined, PictureOutlined } from "@ant-design/icons";
import { ImageOptimizationType, optimizeImageUrl } from "@/lib/image";

export type ImageGenJobStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";

export interface ImageGenJobSnapshot {
  jobId?: string | null;
  status?: ImageGenJobStatus | null;
  ready?: boolean | null;
  imageUrl?: string | null;
  reservedCdnUrl?: string | null;
  cdnUrl?: string | null;
  errorMessage?: string | null;
  elapsed?: string | null;
  model?: string | null;
  resourceUri?: string | null;
}

interface ImageGenJobImageProps {
  job?: ImageGenJobSnapshot | null;
  jobId?: string | null;
  imageUrl?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  preview?: boolean | { mask?: React.ReactNode };
  optimizationType?: ImageOptimizationType;
  pollIntervalMs?: number;
  onJobChange?: (job: ImageGenJobSnapshot) => void;
}

interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

const STATUS_LABEL: Record<ImageGenJobStatus, string> = {
  PENDING: "排队中",
  PROCESSING: "处理中",
  SUCCESS: "已完成",
  FAILED: "失败",
};

export const IMAGE_GEN_FALLBACK =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YxZjVmOSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTRhM2I4IiBmb250LXNpemU9IjE0Ij7lm77niYfliqDovb3lpLHotKU8L3RleHQ+PC9zdmc+";

function isRunningStatus(status?: string | null) {
  return status === "PENDING" || status === "PROCESSING";
}

function mergeJobState(
  current: ImageGenJobSnapshot | null,
  incoming?: ImageGenJobSnapshot | null,
): ImageGenJobSnapshot | null {
  if (!incoming) return current;
  return { ...current, ...incoming };
}

function ImageGenJobImage({
  job,
  jobId,
  imageUrl,
  alt,
  className,
  imageClassName,
  preview = { mask: "预览" },
  optimizationType = ImageOptimizationType.POST_CARD_COVER,
  pollIntervalMs = 3000,
  onJobChange,
}: ImageGenJobImageProps) {
  const [polledJob, setPolledJob] = useState<ImageGenJobSnapshot | null>(null);
  const propJobId = jobId || job?.jobId || null;
  const activePolledJob = polledJob?.jobId === propJobId ? polledJob : null;
  const snapshot = useMemo(
    () => mergeJobState(job || null, activePolledJob),
    [activePolledJob, job],
  );

  const effectiveJobId = jobId || snapshot?.jobId || null;
  const status = snapshot?.status;
  const isRunning = isRunningStatus(status);
  const rawCompletedUrl = status && status !== "SUCCESS"
    ? null
    : snapshot?.imageUrl || snapshot?.cdnUrl || imageUrl || null;
  const displayUrl = useMemo(
    () => optimizeImageUrl(rawCompletedUrl, optimizationType),
    [optimizationType, rawCompletedUrl],
  );

  const fetchJob = useCallback(async (signal: AbortSignal) => {
    if (!effectiveJobId) return;
    const response = await fetch(`/api/image-gen/jobs/${effectiveJobId}`, {
      cache: "no-store",
      signal,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
    const payload = await response.json() as ApiResponse<ImageGenJobSnapshot>;
    if (!response.ok || !payload.status) {
      throw new Error(payload.message || "查询图片任务失败");
    }
    setPolledJob(payload.data);
    onJobChange?.(payload.data);
  }, [effectiveJobId, onJobChange]);

  useEffect(() => {
    if (!effectiveJobId || !isRunning) return undefined;

    const controller = new AbortController();
    let timer: number | null = null;
    let stopped = false;

    const tick = async () => {
      try {
        await fetchJob(controller.signal);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Poll image generation job failed:", error);
        }
      }
      if (!stopped) {
        timer = window.setTimeout(tick, pollIntervalMs);
      }
    };

    timer = window.setTimeout(tick, pollIntervalMs);

    return () => {
      stopped = true;
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [effectiveJobId, fetchJob, isRunning, pollIntervalMs]);

  if (displayUrl) {
    return (
      <div className={className}>
        <Image
          src={displayUrl}
          alt={alt}
          preview={preview}
          fallback={IMAGE_GEN_FALLBACK}
          className={imageClassName}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          wrapperStyle={{ width: "100%", height: "100%" }}
        />
      </div>
    );
  }

  if (status === "FAILED") {
    return (
      <div className={className}>
        <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 p-3 text-center text-slate-500">
          <CloseCircleOutlined className="text-2xl text-red-300" />
          <span className="line-clamp-2 text-xs">
            {snapshot?.errorMessage || "生成失败"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 p-3 text-center text-slate-500">
        {isRunning ? <Spin size="small" /> : <PictureOutlined className="text-2xl text-slate-300" />}
        <span className="text-xs">
          {status ? STATUS_LABEL[status] || status : "等待图片"}
        </span>
      </div>
    </div>
  );
}

export default React.memo(ImageGenJobImage);
