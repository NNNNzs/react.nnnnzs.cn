/**
 * AI 图片生成页面
 * 路由: /c/image-gen
 * 左侧：生成面板 + 当前结果
 * 右侧：持久化历史记录
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, Tag, Spin, message } from "antd";
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
}

export default function ImageGenPage() {
  const router = useRouter();
  const { user, loading: authLoading, hasPermission } = useAuth();

  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<ResultMeta | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!authLoading && user && !hasPermission(IMAGE_VIEW)) {
      message.warning("您没有权限访问此页面");
      router.push("/c/post");
    }
  }, [user, authLoading, router, hasPermission]);

  const handleGenerate = useCallback(
    async (params: import("@/components/ImageGen/ImageGenPanel").ImageGenParams) => {
      setGenerating(true);
      setImageUrl(null);
      setMeta(null);

      try {
        const startTime = Date.now();
        const res = await axios.post("/api/image-gen", params, {
          timeout: 120000,
        });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (res.data?.status && res.data?.data?.imageUrl) {
          const { imageUrl: url } = res.data.data;
          setImageUrl(url);
          setMeta({
            elapsed: res.data.data.elapsed || `${elapsed}s`,
            model: res.data.data.model,
            prompt: params.prompt,
            size: params.size,
            quality: params.quality,
          });
          message.success("图片生成成功");
          // 触发历史记录刷新
          setRefreshTrigger((t) => t + 1);
        } else {
          message.error(res.data?.message || "图片生成失败");
        }
      } catch (error: unknown) {
        console.error("Image gen error:", error);
        const msg =
          (error as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || "图片生成失败，请检查网络或配置";
        message.error(msg);
      } finally {
        setGenerating(false);
      }
    },
    []
  );

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
              <ImageGenPanel loading={generating} onGenerate={handleGenerate} />
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
