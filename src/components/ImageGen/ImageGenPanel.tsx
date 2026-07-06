/**
 * AI 图片生成参数面板
 */

"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  Segmented,
  Input,
  Select,
  Button,
  Image,
  InputNumber,
} from "antd";
import {
  PictureOutlined,
  EditOutlined,
  SendOutlined,
} from "@ant-design/icons";

const { TextArea } = Input;

export interface ImageGenParams {
  mode: "generate" | "edit";
  prompt: string;
  image?: string;
  images?: string[];
  size?: string;
  quality?: string;
}

interface ImageGenPanelProps {
  loading: boolean;
  onGenerate: (params: ImageGenParams) => void;
}

const SIZE_OPTIONS = [
  { value: "1024x1024", label: "1024×1024 (方形)" },
  { value: "1792x1024", label: "1792×1024 (横屏)" },
  { value: "1024x1792", label: "1024×1792 (竖屏)" },
];

const QUALITY_OPTIONS = [
  { value: "low", label: "草稿" },
  { value: "high", label: "高质量" },
  { value: "medium", label: "中等质量" },
  { value: "auto", label: "自动" },
];

export default function ImageGenPanel({ loading, onGenerate }: ImageGenPanelProps) {
  const [mode, setMode] = useState<"generate" | "edit">("generate");
  const [prompt, setPrompt] = useState("");
  const [imageText, setImageText] = useState("");
  const [size, setSize] = useState<string>("1024x1024");
  const [customWidth, setCustomWidth] = useState<number | null>(1024);
  const [customHeight, setCustomHeight] = useState<number | null>(1024);
  const [quality, setQuality] = useState<string>("high");

  const isCustomSize = !SIZE_OPTIONS.some((o) => o.value === size);
  const imageUrls = useMemo(
    () => imageText
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean),
    [imageText],
  );

  const handleSizeChange = (val: string) => {
    setSize(val);
    if (val === "custom") return;
    const [w, h] = val.split("x").map(Number);
    setCustomWidth(w);
    setCustomHeight(h);
  };

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    const finalSize = isCustomSize && customWidth && customHeight
      ? `${customWidth}x${customHeight}`
      : (size || undefined);
    onGenerate({
      mode,
      prompt: prompt.trim(),
      ...(mode === "edit" && imageUrls.length > 0 ? { image: imageUrls[0], images: imageUrls } : {}),
      size: finalSize,
      quality: quality || undefined,
    });
  }, [mode, prompt, imageUrls, size, quality, onGenerate, isCustomSize, customWidth, customHeight]);

  return (
    <div className="space-y-4">
      <Segmented
        block
        value={mode}
        onChange={(v) => setMode(v as "generate" | "edit")}
        options={[
          { value: "generate", label: "文生图", icon: <PictureOutlined /> },
          { value: "edit", label: "图文编辑", icon: <EditOutlined /> },
        ]}
      />

      {mode === "edit" && (
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-600">
            参考图片 URL
            <span className="text-red-400 ml-1">*</span>
          </label>
          <TextArea
            value={imageText}
            onChange={(e) => setImageText(e.target.value)}
            placeholder="每行输入一张参考图片 URL，支持多图参考"
            rows={3}
            autoSize={{ minRows: 2, maxRows: 6 }}
            allowClear
          />
          {imageUrls.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {imageUrls.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className="relative overflow-hidden rounded-md border border-gray-200 bg-gray-50"
                >
                  <Image
                    src={url}
                    alt={`参考图 ${index + 1}`}
                    width="100%"
                    height={88}
                    preview={{ mask: `查看 ${index + 1}` }}
                    style={{ objectFit: "cover" }}
                    fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5IiBmb250LXNpemU9IjE0Ij7lm77niYfliqDovb3lpLHotKU8L3RleHQ+PC9zdmc+"
                  />
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block mb-1 text-sm font-medium text-gray-600">
          {mode === "edit" ? "编辑指令" : "提示词"}
          <span className="text-red-400 ml-1">*</span>
        </label>
        <TextArea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            mode === "edit"
              ? "描述要对参考图片进行的修改..."
              : "描述你想要生成的图片..."
          }
          rows={4}
          maxLength={32000}
          showCount
          autoSize={{ minRows: 3, maxRows: 10 }}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block mb-1 text-sm font-medium text-gray-600">尺寸</label>
          <Select
            value={isCustomSize ? "custom" : size}
            onChange={handleSizeChange}
            className="w-full"
            options={[
              ...SIZE_OPTIONS,
              { value: "custom", label: "自定义" },
            ]}
          />
          {isCustomSize && (
            <div className="flex gap-2 mt-2">
              <InputNumber
                value={customWidth}
                onChange={setCustomWidth}
                placeholder="宽"
                min={256}
                max={4096}
                step={64}
                className="flex-1"
              />
              <span className="self-center text-gray-400">×</span>
              <InputNumber
                value={customHeight}
                onChange={setCustomHeight}
                placeholder="高"
                min={256}
                max={4096}
                step={64}
                className="flex-1"
              />
            </div>
          )}
        </div>
        <div className="flex-1">
          <label className="block mb-1 text-sm font-medium text-gray-600">质量</label>
          <Select
            value={quality}
            onChange={setQuality}
            className="w-full"
            options={QUALITY_OPTIONS}
          />
        </div>
      </div>

      <Button variant="solid" color="primary"
        icon={<SendOutlined />}
        loading={loading}
        disabled={!prompt.trim() || (mode === "edit" && imageUrls.length === 0)}
        onClick={handleGenerate}
        size="large"
        block
      >
        {loading ? "生成中..." : "生成图片"}
      </Button>
    </div>
  );
}
