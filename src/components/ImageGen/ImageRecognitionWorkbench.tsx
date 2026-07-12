"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button, Drawer, Empty, Image, Input, Select, message } from "antd";
import {
  CopyOutlined,
  DeleteOutlined,
  EyeOutlined,
  HistoryOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import ImageReferenceAddModal, { type AddedImageReference } from "@/components/ImageGen/ImageReferenceAddModal";

type RecognitionDetail = "low" | "auto" | "high";

interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface RecognitionResult {
  description: string;
  model: string;
  detail: RecognitionDetail;
}

interface RecognitionHistoryItem extends RecognitionResult {
  id: string;
  createdAt: number;
  prompt: string;
  imageUrl?: string;
  localImageName?: string;
}

const HISTORY_STORAGE_KEY = "ai-lab:image-recognition-history:v1";
const MAX_HISTORY_ITEMS = 20;
const DEFAULT_PROMPT = "请详细描述这张图片的内容";

function createHistoryId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ImageRecognitionWorkbench() {
  const [reference, setReference] = useState<AddedImageReference | null>(null);
  const [referenceModalOpen, setReferenceModalOpen] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [detail, setDetail] = useState<RecognitionDetail>("low");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecognitionHistoryItem | null>(null);
  const [history, setHistory] = useState<RecognitionHistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyHydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(HISTORY_STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setHistory(parsed.filter((item): item is RecognitionHistoryItem => (
          item !== null
          && typeof item === "object"
          && typeof item.id === "string"
          && typeof item.description === "string"
          && typeof item.prompt === "string"
          && typeof item.model === "string"
          && ["low", "auto", "high"].includes(String(item.detail))
        )).slice(0, MAX_HISTORY_ITEMS));
      }
    } catch {
      window.sessionStorage.removeItem(HISTORY_STORAGE_KEY);
    } finally {
      historyHydrated.current = true;
    }
  }, []);

  useEffect(() => {
    if (!historyHydrated.current) return;
    try {
      window.sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      message.warning("识图历史无法写入浏览器会话");
    }
  }, [history]);

  const handleRecognize = async () => {
    if (!reference?.url) {
      message.warning("请先添加识别图");
      return;
    }
    const normalizedPrompt = prompt.trim() || DEFAULT_PROMPT;
    setLoading(true);
    try {
      const response = await fetch("/api/image-gen/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: reference.url, prompt: normalizedPrompt, detail }),
      });
      const payload = await response.json() as ApiResponse<RecognitionResult>;
      if (!response.ok || !payload.status) throw new Error(payload.message || "图片识别失败");

      const item: RecognitionHistoryItem = {
        id: createHistoryId(),
        createdAt: Date.now(),
        prompt: normalizedPrompt,
        description: payload.data.description,
        model: payload.data.model,
        detail: payload.data.detail,
        imageUrl: reference.url,
      };
      setResult(item);
      setHistory((current) => [item, ...current].slice(0, MAX_HISTORY_ITEMS));
      message.success("图片识别完成");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "图片识别失败");
    } finally {
      setLoading(false);
    }
  };

  const copyDescription = (description: string) => {
    void navigator.clipboard.writeText(description).then(
      () => message.success("识别结果已复制"),
      () => message.error("复制失败"),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="text-sm text-slate-600">添加一张图片，向多模态模型提问。</div>
        <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>
          会话历史{history.length > 0 ? ` (${history.length})` : ""}
        </Button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-3">
        <div className="mb-2 text-sm font-medium text-slate-700">识别图</div>
        <Button icon={<PictureOutlined />} onClick={() => setReferenceModalOpen(true)}>添加识别图</Button>
        {reference ? (
          <div className="mt-3 grid max-w-sm grid-cols-1 gap-2">
            <div className="relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-50">
              <Image
                src={reference.url}
                alt={reference.title || "识别图"}
                preview
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                wrapperStyle={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%" }}
              />
              <Button
                aria-label="移除识别图"
                style={{ position: "absolute", top: 6, right: 6, zIndex: 2 }}
                size="small"
                danger
                shape="circle"
                icon={<DeleteOutlined />}
                onClick={() => setReference(null)}
              />
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded border border-dashed border-slate-300 py-5 text-center text-xs text-slate-500">
            点击“添加识别图”上传图片或填写图片外链
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">想了解什么？</label>
        <Input.TextArea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} maxLength={4000} showCount />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">识图精度</label>
        <Select
          className="w-full"
          value={detail}
          onChange={setDetail}
          options={[{ value: "low", label: "快速" }, { value: "auto", label: "自动" }, { value: "high", label: "高精度" }]}
        />
      </div>
      <Button type="primary" icon={<EyeOutlined />} loading={loading} onClick={handleRecognize} block size="large">
        {loading ? "识别中..." : "开始识别"}
      </Button>

      {result ? (
        <div className="rounded-md border border-cyan-200 bg-cyan-50/60 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-800">识别结果</span>
            <Button size="small" icon={<CopyOutlined />} onClick={() => copyDescription(result.description)}>复制</Button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{result.description}</p>
          <p className="mt-3 text-xs text-slate-500">模型：{result.model} · 精度：{result.detail}</p>
        </div>
      ) : null}

      <ImageReferenceAddModal
        open={referenceModalOpen}
        onClose={() => setReferenceModalOpen(false)}
        onReferenceAdded={setReference}
      />
      <Drawer
        title="本次会话识图历史"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        width={420}
        extra={<Button type="text" danger disabled={history.length === 0} onClick={() => setHistory([])}>清空</Button>}
      >
        {history.length > 0 ? (
          <div className="flex flex-col gap-2">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-md border border-slate-200 p-3 text-left transition-colors hover:border-cyan-300 hover:bg-cyan-50/40"
                onClick={() => {
                  setResult(item);
                  if (item.imageUrl) setReference({ url: item.imageUrl });
                  setHistoryOpen(false);
                }}
              >
                <div className="line-clamp-2 text-sm text-slate-700">{item.prompt}</div>
                <div className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{item.description}</div>
                <div className="mt-2 text-[11px] text-slate-400">
                  {new Date(item.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </button>
            ))}
          </div>
        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本次会话暂无识图记录" />}
      </Drawer>
    </div>
  );
}
