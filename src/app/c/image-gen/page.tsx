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
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import type { ImageGenJobSnapshot } from "@/components/ImageGen/ImageGenJobImage";

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
  const terminalJobIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && user && !hasPermission(IMAGE_VIEW)) {
      message.warning("您没有权限访问此页面");
      router.push("/c/post");
    }
  }, [user, authLoading, router, hasPermission]);

  const handleGenerate = useCallback(
    async (params: import("@/components/ImageGen/ImageGenPanel").ImageGenParams) => {
      if (generating) return;
      setGenerating(true);
      setImageUrl(null);
      setMeta(null);

      try {
        const res = await axios.post("/api/image-gen", params, {
          timeout: 15000,
        });

        if (res.data?.status && res.data?.data?.jobId) {
          const job = res.data.data as ImageGenerationJob;
          setImageUrl(job.status === "SUCCESS" ? job.imageUrl : null);
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
          message.success("图片生成任务已提交");
        } else {
          message.error(res.data?.message || "图片生成失败");
          setGenerating(false);
        }
      } catch (error: unknown) {
        console.error("Image gen error:", error);
        const msg =
          (error as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || "图片生成失败，请检查网络或配置";
        message.error(msg);
        setGenerating(false);
      }
    },
    [generating]
  );

  const handleJobChange = useCallback((job: ImageGenJobSnapshot) => {
    const jobId = job.jobId;
    setImageUrl(job.status === "SUCCESS" ? job.imageUrl || job.cdnUrl || null : null);
    setMeta((current) => ({
      ...current,
      elapsed: job.elapsed || current?.elapsed,
      model: job.model || current?.model,
      size: job.size || current?.size,
      quality: job.quality || current?.quality,
      jobId: job.jobId || current?.jobId,
      status: job.status || current?.status,
      resourceUri: job.resourceUri || current?.resourceUri,
      errorMessage: job.errorMessage ?? current?.errorMessage,
    }));

    if (!jobId || terminalJobIdsRef.current.has(jobId)) return;

    if (job.status === "SUCCESS" && job.imageUrl) {
      terminalJobIdsRef.current.add(jobId);
      setGenerating(false);
      message.success("图片生成成功");
      setRefreshTrigger((t) => t + 1);
    } else if (job.status === "FAILED") {
      terminalJobIdsRef.current.add(jobId);
      setGenerating(false);
      message.error(job.errorMessage || "图片生成失败");
      setRefreshTrigger((t) => t + 1);
    }
  }, []);

  const debouncedGenerate = useMemo(
    () => debounce(handleGenerate, 3000, { leading: true, trailing: false }),
    [handleGenerate]
  );

  useEffect(() => {
    return () => {
      debouncedGenerate.cancel();
    };
  }, [debouncedGenerate]);

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
        <AdminPageHeader
          title="AI 图片生成"
          icon={<PictureOutlined className="text-xl text-blue-500" />}
          tag={<Tag color="blue">GPT Image 2</Tag>}
        />

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
              onJobChange={handleJobChange}
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
