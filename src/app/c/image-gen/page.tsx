/**
 * AI 图片生成页面
 * 路由: /c/image-gen
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, Row, Col, Tag, Spin, message } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import axios from "@/lib/axios";
import { useAuth } from "@/contexts/AuthContext";
import { IMAGE_VIEW } from "@/constants/permissions";
import { useRouter } from "next/navigation";
import ImageGenPanel from "@/components/ImageGen/ImageGenPanel";
import ImageResultCard from "@/components/ImageGen/ImageResultCard";

interface HistoryItem {
  id: string;
  imageUrl: string;
  prompt: string;
  mode: "generate" | "edit";
  size?: string;
  quality?: string;
  elapsed?: string;
  timestamp: number;
}

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
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (!authLoading && user && !hasPermission(IMAGE_VIEW)) {
      message.warning("您没有权限访问此页面");
      router.push("/c/post");
    }
  }, [user, authLoading, router]);

  const addHistory = useCallback(
    (item: Omit<HistoryItem, "id" | "timestamp">) => {
      setHistory((prev) => [
        ...prev,
        { ...item, id: crypto.randomUUID(), timestamp: Date.now() },
      ]);
    },
    []
  );

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
          const newMeta: ResultMeta = {
            elapsed: res.data.data.elapsed || `${elapsed}s`,
            model: res.data.data.model,
            prompt: params.prompt,
            size: params.size,
            quality: params.quality,
          };
          setMeta(newMeta);
          addHistory({
            imageUrl: url,
            prompt: params.prompt,
            mode: params.mode,
            size: params.size,
            quality: params.quality,
            elapsed: newMeta.elapsed,
          });
          message.success("图片生成成功");
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
    [addHistory]
  );

  const handleHistoryClick = useCallback((item: HistoryItem) => {
    setImageUrl(item.imageUrl);
    setMeta({
      elapsed: item.elapsed,
      prompt: item.prompt,
      size: item.size,
      quality: item.quality,
    });
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <PictureOutlined className="text-2xl text-blue-500" />
        <h1 className="text-2xl font-bold">AI 图片生成</h1>
        <Tag color="blue">GPT Image 2</Tag>
      </div>

      <Row gutter={[24, 16]}>
        <Col xs={24} lg={14}>
          <Card title="参数配置" size="small">
            <ImageGenPanel loading={generating} onGenerate={handleGenerate} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <ImageResultCard
            imageUrl={imageUrl}
            loading={generating}
            meta={meta}
            history={history}
            onHistoryClick={handleHistoryClick}
          />
        </Col>
      </Row>
    </div>
  );
}
