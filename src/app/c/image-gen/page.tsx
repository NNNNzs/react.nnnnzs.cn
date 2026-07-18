/**
 * AI 图片工作台
 * 路由: /c/image-gen（/c/ai-lab/image-gen 复用本页）
 */

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, Spin, Tag, message } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import axios from "@/lib/axios";
import { useAuth } from "@/contexts/AuthContext";
import { IMAGE_VIEW } from "@/constants/permissions";
import { useRouter, useSearchParams } from "next/navigation";
import ImageGenerationComposer, {
  type ImageGenerationRequest,
} from "@/components/ImageGen/ImageGenerationComposer";
import ImageResultCard from "@/components/ImageGen/ImageResultCard";
import ImageGenHistory from "@/components/ImageGen/ImageGenHistory";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import type { ImageGenJobSnapshot } from "@/components/ImageGen/ImageGenJobImage";

interface ResultMeta {
  elapsed?: string;
  model?: string;
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
  resourceUri: string;
}

export default function ImageGenPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, hasPermission } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<ResultMeta | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const terminalJobIdsRef = useRef<Set<string>>(new Set());
  const restoredJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authLoading && user && !hasPermission(IMAGE_VIEW)) {
      message.warning("您没有权限访问此页面");
      router.push("/c/post");
    }
  }, [user, authLoading, router, hasPermission]);

  const submitGeneration = useCallback(async (params: ImageGenerationRequest) => {
    const response = await axios.post("/api/image-gen", params, { timeout: 15000 });
    if (!response.data?.status || !response.data?.data?.jobId) {
      throw new Error(response.data?.message || "图片生成任务提交失败");
    }
    return response.data.data as ImageGenerationJob;
  }, []);

  const handleQueued = useCallback((result: unknown) => {
    const job = result as ImageGenerationJob;
    setImageUrl(job.status === "SUCCESS" ? job.imageUrl : null);
    setMeta({
      elapsed: job.elapsed || undefined,
      model: job.model || undefined,
      jobId: job.jobId,
      status: job.status,
      resourceUri: job.resourceUri,
      errorMessage: job.errorMessage,
    });
    setRefreshTrigger((value) => value + 1);
  }, []);

  const handleJobChange = useCallback((job: ImageGenJobSnapshot) => {
    const jobId = job.jobId;
    setImageUrl(job.status === "SUCCESS" ? job.imageUrl || job.cdnUrl || null : null);
    setMeta((current) => ({
      ...current,
      elapsed: job.elapsed || current?.elapsed,
      model: job.model || current?.model,
      jobId: job.jobId || current?.jobId,
      status: job.status || current?.status,
      resourceUri: job.resourceUri || current?.resourceUri,
      errorMessage: job.errorMessage ?? current?.errorMessage,
    }));

    if (!jobId || terminalJobIdsRef.current.has(jobId)) return;
    if (job.status === "SUCCESS" && job.imageUrl) {
      terminalJobIdsRef.current.add(jobId);
      message.success("图片生成成功");
      setRefreshTrigger((value) => value + 1);
    } else if (job.status === "FAILED") {
      terminalJobIdsRef.current.add(jobId);
      message.error(job.errorMessage || "图片生成失败");
      setRefreshTrigger((value) => value + 1);
    }
  }, []);

  useEffect(() => {
    const requestedJobId = searchParams.get("jobId");
    if (!requestedJobId || authLoading || !user || restoredJobIdRef.current === requestedJobId) return;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedJobId)) {
      message.warning("无效的图片任务 ID");
      router.replace("/c/image-gen");
      return;
    }

    restoredJobIdRef.current = requestedJobId;
    const controller = new AbortController();
    void fetch(`/api/image-gen/jobs/${requestedJobId}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "Cache-Control": "no-store" },
    })
      .then(async (response) => {
        const payload = await response.json() as { status: boolean; message: string; data: ImageGenerationJob };
        if (!response.ok || !payload.status) throw new Error(payload.message || "图片任务不存在");
        handleJobChange(payload.data);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        restoredJobIdRef.current = null;
        message.error(error instanceof Error ? error.message : "恢复图片任务失败");
        router.replace("/c/image-gen");
      });

    return () => {
      controller.abort();
      if (restoredJobIdRef.current === requestedJobId) restoredJobIdRef.current = null;
    };
  }, [authLoading, handleJobChange, router, searchParams, user]);

  const handleHistorySelect = useCallback((url: string, prompt: string) => {
    setImageUrl(url);
    setMeta({ prompt });
  }, []);

  if (authLoading) {
    return <div className="flex h-64 items-center justify-center"><Spin size="large" /></div>;
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AdminPageHeader
          className="mb-2"
          title="AI 图片工作台"
          icon={<PictureOutlined className="text-xl text-blue-500" />}
          tag={<Tag color="blue">生成 · 编辑 · 识别</Tag>}
        />
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          <div className="flex min-h-0 w-full flex-col gap-3 lg:w-[55%] lg:overflow-y-auto lg:pr-1">
            <Card title="参数配置" size="small" className="shrink-0">
              <ImageGenerationComposer onSubmit={submitGeneration} onSuccess={handleQueued} submitLabel="提交队列任务" />
            </Card>
            <div className="shrink-0">
              <ImageResultCard imageUrl={imageUrl} loading={false} meta={meta} history={[]} onJobChange={handleJobChange} />
            </div>
          </div>
          <div className="min-h-0 w-full lg:w-[45%]">
            <div className="h-full min-h-0 overflow-hidden rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <ImageGenHistory onSelect={handleHistorySelect} refreshTrigger={refreshTrigger} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
