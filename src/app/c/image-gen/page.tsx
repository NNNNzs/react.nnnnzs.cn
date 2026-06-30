/**
 * AI 图片生成页面
 * 路由: /c/image-gen
 * 左侧：生成面板 + 当前结果
 * 右侧：持久化历史记录
 */

"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Card, Tag, Spin, message } from "antd";
import { debounce } from "lodash-es";
import {
  PictureOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import axios from "@/lib/axios";
import { useAuth } from "@/contexts/AuthContext";
import { IMAGE_VIEW } from "@/constants/permissions";
import { useRouter } from "next/navigation";
import ImageGenPanel from "@/components/ImageGen/ImageGenPanel";
import ImageResultCard from "@/components/ImageGen/ImageResultCard";
import ImageGenHistory from "@/components/ImageGen/ImageGenHistory";

interface ResultMeta {
  elapsed?: string;
  model?: string;
  size?: string;
  quality?: string;
  prompt?: string;
  jobId?: string;
  status?: string;
  resourceUri?: string;
  errorMessage?: string | null;
}

interface ImageGenerationJob {
  jobId: string;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  ready: boolean;
  imageUrl: string | null;
  errorMessage: string | null;
  elapsed: string | null;
  model: string | null;
  size: string | null;
  quality: string | null;
  resourceUri: string;
}

export default function ImageGenPage() {
  const router = useRouter();
  const { user, loading: authLoading, hasPermission } = useAuth();

  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<ResultMeta | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const generatingRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user && !hasPermission(IMAGE_VIEW)) {
      message.warning("您没有权限访问此页面");
      router.push("/c/post");
    }
  }, [user, authLoading, router, hasPermission]);

  const MAX_POLL_COUNT = 60; // 最大轮询次数（60 次 × 3 秒 ≈ 3 分钟）

  const stopPoll = useCallback(() => {
    clearPollTimer();
    pollCountRef.current = 0;
    generatingRef.current = false;
    setGenerating(false);
  }, [clearPollTimer]);

  const pollJob = useCallback(
    async (
      jobId: string,
      params: import("@/components/ImageGen/ImageGenPanel").ImageGenParams
    ) => {
      pollCountRef.current += 1;

      if (pollCountRef.current > MAX_POLL_COUNT) {
        message.warning("任务查询超时，请稍后在历史记录中查看");
        stopPoll();
        setRefreshTrigger((t) => t + 1);
        return;
      }

      try {
        const res = await axios.get(`/api/image-gen/jobs/${jobId}`, {
          headers: { "Cache-Control": "no-store" },
        });
        const job = res.data?.data as ImageGenerationJob | undefined;

        if (!res.data?.status || !job) {
          throw new Error(res.data?.message || "查询任务状态失败");
        }

        setImageUrl(job.imageUrl);
        setMeta({
          elapsed: job.elapsed || undefined,
          model: job.model || undefined,
          prompt: params.prompt,
          size: job.size || params.size,
          quality: job.quality || params.quality,
          jobId: job.jobId,
          status: job.status,
          resourceUri: job.resourceUri,
          errorMessage: job.errorMessage,
        });

        if (job.status === "SUCCESS" && job.imageUrl) {
          generatingRef.current = false;
          setGenerating(false);
          message.success("图片生成成功");
          setRefreshTrigger((t) => t + 1);
          return;
        }

        if (job.status === "FAILED") {
          setImageUrl(null);
          generatingRef.current = false;
          setGenerating(false);
          message.error(job.errorMessage || "图片生成失败");
          setRefreshTrigger((t) => t + 1);
          return;
        }

        pollTimerRef.current = setTimeout(() => {
          void pollJob(jobId, params);
        }, 3000);
      } catch (error: unknown) {
        console.error("Poll image gen job error:", error);
        if (pollCountRef.current > MAX_POLL_COUNT) {
          message.warning("任务查询超时，请稍后在历史记录中查看");
          stopPoll();
          setRefreshTrigger((t) => t + 1);
          return;
        }
        pollTimerRef.current = setTimeout(() => {
          void pollJob(jobId, params);
        }, 5000);
      }
    },
    [stopPoll]
  );

  const handleGenerate = useCallback(
    async (params: import("@/components/ImageGen/ImageGenPanel").ImageGenParams) => {
      if (generatingRef.current) return;
      clearPollTimer();
      pollCountRef.current = 0;
      generatingRef.current = true;
      setGenerating(true);
      setImageUrl(null);
      setMeta(null);

      try {
        const res = await axios.post("/api/image-gen", params, {
          timeout: 15000,
        });

        if (res.data?.status && res.data?.data?.jobId) {
          const job = res.data.data as ImageGenerationJob;
          setImageUrl(job.imageUrl);
          setMeta({
            elapsed: job.elapsed || undefined,
            model: job.model || undefined,
            prompt: params.prompt,
            size: job.size || params.size,
            quality: job.quality || params.quality,
            jobId: job.jobId,
            status: job.status,
            resourceUri: job.resourceUri,
          });
          message.success("图片生成任务已提交");
          void pollJob(job.jobId, params);
        } else {
          message.error(res.data?.message || "图片生成失败");
          generatingRef.current = false;
          setGenerating(false);
        }
      } catch (error: unknown) {
        console.error("Image gen error:", error);
        const msg =
          (error as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || "图片生成失败，请检查网络或配置";
        message.error(msg);
        generatingRef.current = false;
        setGenerating(false);
      }
    },
    [clearPollTimer, pollJob]
  );

  const debouncedGenerate = useMemo(
    () => debounce(
      (params: import("@/components/ImageGen/ImageGenPanel").ImageGenParams) => {
        handleGenerate(params);
      },
      3000,
      { leading: true, trailing: false }
    ),
    [handleGenerate]
  );

  useEffect(() => {
    return () => {
      debouncedGenerate.cancel();
      clearPollTimer();
    };
  }, [debouncedGenerate, clearPollTimer]);

  const handleHistorySelect = useCallback(
    (url: string, prompt: string) => {
      setImageUrl(url);
      setMeta({ prompt });
    },
    []
  );

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        {/* 标题栏 */}
        <div className="shrink-0 flex items-center gap-2 mb-4">
          <PictureOutlined className="text-2xl text-blue-500" />
          <h1 className="text-2xl font-bold">AI 图片生成</h1>
          <Tag color="blue">GPT Image 2</Tag>
        </div>

        {/* 左右分栏 */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
          {/* 左侧：生成面板 + 结果 */}
          <div className="w-full lg:w-1/2 xl:w-[55%] shrink-0 flex flex-col gap-4 lg:overflow-y-auto">
            <Card title="参数配置" size="small">
              <ImageGenPanel loading={generating} onGenerate={debouncedGenerate} />
            </Card>
            <ImageResultCard
              imageUrl={imageUrl}
              loading={generating}
              meta={meta}
              history={[]}
            />
          </div>

          {/* 右侧：历史记录 */}
          <div className="w-full lg:w-1/2 xl:w-[45%] min-h-0">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 h-full">
              <div className="flex items-center gap-2 mb-2">
                <HistoryOutlined className="text-base text-gray-500" />
                <span className="text-sm font-medium">生成历史</span>
              </div>
              <div className="h-[calc(100%-32px)]">
                <ImageGenHistory
                  onSelect={handleHistorySelect}
                  refreshTrigger={refreshTrigger}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
