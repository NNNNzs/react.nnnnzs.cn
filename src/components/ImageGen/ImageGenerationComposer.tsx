"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  Button,
  Image,
  Input,
  InputNumber,
  Segmented,
  Select,
  message,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PictureOutlined,
  PlusOutlined,
  ScanOutlined,
  SendOutlined,
} from "@ant-design/icons";
import ImageReferenceAddModal, { type AddedImageReference } from "@/components/ImageGen/ImageReferenceAddModal";
import ImageRecognitionWorkbench from "@/components/ImageGen/ImageRecognitionWorkbench";

export type ImageGenerationMode = "generate" | "edit" | "recognize";

export interface ImageReference {
  url: string;
  title?: string;
  assetId?: number;
}

export interface ImageGenerationRequest {
  mode: "generate" | "edit";
  prompt: string;
  image?: string;
  images?: string[];
  group?: string;
}

export interface ImageGenerationComposerHandle {
  addReferenceImages: (images: Array<ImageReference | string>) => void;
}

interface ImageGenerationComposerProps {
  onSubmit: (params: ImageGenerationRequest) => Promise<unknown>;
  onSuccess?: (result: unknown) => void;
  onReferencesChange?: (references: ImageReference[]) => void;
  extra?: React.ReactNode;
  submitLabel?: string;
}

const SIZE_OPTIONS = [
  { value: "1024x1024", label: "1024×1024（方形）" },
  { value: "1792x1024", label: "1792×1024（横屏）" },
  { value: "1024x1792", label: "1024×1792（竖屏）" },
];

const QUALITY_OPTIONS = [
  { value: "low", label: "草稿" },
  { value: "medium", label: "中等" },
  { value: "high", label: "高质量" },
  { value: "auto", label: "自动" },
];

const MAX_REFERENCE_IMAGES = 10;

export function appendImageGenerationConstraints(prompt: string, size: string, quality: string) {
  return `${prompt.trim()}\n\n【生成约束】尺寸：${size}；质量：${quality}。`;
}

function normalizeReferences(images: Array<ImageReference | string>) {
  const uniqueUrls = new Set<string>();
  return images.reduce<ImageReference[]>((result, image) => {
    const reference = typeof image === "string" ? { url: image } : image;
    const url = reference.url.trim();
    if (!url || uniqueUrls.has(url)) return result;
    uniqueUrls.add(url);
    result.push({ ...reference, url });
    return result;
  }, []);
}

const ImageGenerationComposer = forwardRef<ImageGenerationComposerHandle, ImageGenerationComposerProps>(
  function ImageGenerationComposer({ onSubmit, onSuccess, onReferencesChange, extra, submitLabel = "提交队列任务" }, ref) {
    const [mode, setMode] = useState<ImageGenerationMode>("generate");
    const [prompt, setPrompt] = useState("");
    const [references, setReferences] = useState<ImageReference[]>([]);
    const [size, setSize] = useState("1024x1024");
    const [customWidth, setCustomWidth] = useState<number | null>(1024);
    const [customHeight, setCustomHeight] = useState<number | null>(1024);
    const [quality, setQuality] = useState("high");
    const [group, setGroup] = useState("");
    const [referenceAddOpen, setReferenceAddOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const isCustomSize = !SIZE_OPTIONS.some((option) => option.value === size);
    const finalSize = useMemo(() => (
      isCustomSize && customWidth && customHeight
        ? `${customWidth}x${customHeight}`
        : size
    ), [customHeight, customWidth, isCustomSize, size]);

    const addReferenceImages = useCallback((images: Array<ImageReference | string>) => {
      const additions = normalizeReferences(images);
      if (additions.length === 0) return;

      setMode("edit");
      setReferences((current) => {
        const merged = normalizeReferences([...current, ...additions]);
        if (merged.length > MAX_REFERENCE_IMAGES) {
          message.warning(`图文编辑最多支持 ${MAX_REFERENCE_IMAGES} 张参考图`);
        }
        return merged.slice(0, MAX_REFERENCE_IMAGES);
      });
    }, []);

    useImperativeHandle(ref, () => ({ addReferenceImages }), [addReferenceImages]);

    useEffect(() => {
      onReferencesChange?.(references);
    }, [onReferencesChange, references]);

    const removeReference = (url: string) => {
      setReferences((current) => current.filter((reference) => reference.url !== url));
    };

    const handleSizeChange = (value: string) => {
      setSize(value);
      if (value === "custom") return;
      const [width, height] = value.split("x").map(Number);
      setCustomWidth(width);
      setCustomHeight(height);
    };

    const handleReferenceAdded = (reference: AddedImageReference) => {
      addReferenceImages([reference]);
    };

    const handleSubmit = async () => {
      if (mode === "recognize") return;
      if (!prompt.trim()) {
        message.warning("请输入提示词");
        return;
      }
      if (mode === "edit" && references.length === 0) {
        message.warning("图文编辑需要至少一张参考图");
        return;
      }

      setSubmitting(true);
      try {
        const images = references.map((reference) => reference.url);
        const result = await onSubmit({
          mode,
          prompt: appendImageGenerationConstraints(prompt, finalSize, quality),
          ...(mode === "edit" ? { image: images[0], images } : {}),
          ...(group.trim() ? { group: group.trim() } : {}),
        });
        message.success("图片任务已加入队列");
        setPrompt("");
        onSuccess?.(result);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "提交图片任务失败");
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="flex flex-col gap-4">
        <Segmented
          block
          value={mode}
          onChange={(value) => setMode(value as ImageGenerationMode)}
          options={[
            { value: "generate", label: "文生图", icon: <PictureOutlined /> },
            { value: "edit", label: "图文编辑", icon: <EditOutlined /> },
            { value: "recognize", label: "图片识别", icon: <ScanOutlined /> },
          ]}
        />

        {mode === "recognize" ? <ImageRecognitionWorkbench /> : <>
        {mode === "edit" ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-sm font-medium text-slate-700">参考图</div>
            <Button size="small" icon={<PlusOutlined />} onClick={() => setReferenceAddOpen(true)}>
              添加参考图
            </Button>
            {references.length > 0 ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {references.map((reference, index) => (
                  <div key={reference.url} className="relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-white">
                    <Image
                      src={reference.url}
                      alt={reference.title || `参考图 ${index + 1}`}
                      preview
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      wrapperStyle={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%" }}
                    />
                    <Button
                      aria-label={`移除参考图 ${index + 1}`}
                      style={{ position: "absolute", top: 6, right: 6, zIndex: 2 }}
                      size="small"
                      danger
                      shape="circle"
                      icon={<DeleteOutlined />}
                      onClick={() => removeReference(reference.url)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded border border-dashed border-slate-300 py-5 text-center text-xs text-slate-500">
                点击“添加参考图”上传图片或填写图片外链
              </div>
            )}
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {mode === "edit" ? "编辑指令" : "提示词"}
          </label>
          <Input.TextArea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={mode === "edit" ? "描述要怎样修改参考图..." : "描述你想生成的图片..."}
            rows={5}
            maxLength={32000}
            showCount
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">尺寸</label>
            <Select
              className="w-full"
              value={isCustomSize ? "custom" : size}
              onChange={handleSizeChange}
              options={[...SIZE_OPTIONS, { value: "custom", label: "自定义" }]}
            />
            {isCustomSize ? (
              <div className="mt-2 flex items-center gap-2">
                <InputNumber className="min-w-0 flex-1" min={256} max={4096} step={64} value={customWidth} onChange={setCustomWidth} />
                <span className="text-slate-400">×</span>
                <InputNumber className="min-w-0 flex-1" min={256} max={4096} step={64} value={customHeight} onChange={setCustomHeight} />
              </div>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">质量</label>
            <Select className="w-full" value={quality} onChange={setQuality} options={QUALITY_OPTIONS} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">分组</label>
          <Input
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            placeholder="如：封面图、参考图"
            maxLength={60}
          />
        </div>

        {extra}

        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={submitting}
          disabled={!prompt.trim() || (mode === "edit" && references.length === 0)}
          onClick={handleSubmit}
          block
          size="large"
        >
          {submitting ? "提交中..." : submitLabel}
        </Button>

        <ImageReferenceAddModal
          open={referenceAddOpen}
          onClose={() => setReferenceAddOpen(false)}
          onReferenceAdded={handleReferenceAdded}
        />
        </>}
      </div>
    );
  },
);

ImageGenerationComposer.displayName = "ImageGenerationComposer";

export default ImageGenerationComposer;
