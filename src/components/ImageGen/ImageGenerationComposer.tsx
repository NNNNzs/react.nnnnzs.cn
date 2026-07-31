"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { AutoComplete, Button, Image, Input, Segmented, message } from "antd";
import { DeleteOutlined, PictureOutlined, PlusOutlined, ScanOutlined, SendOutlined } from "@ant-design/icons";
import ImageReferenceAddModal, { type AddedImageReference } from "@/components/ImageGen/ImageReferenceAddModal";
import ImageRecognitionWorkbench from "@/components/ImageGen/ImageRecognitionWorkbench";

export interface ImageReference {
  url: string;
  title?: string;
  assetId?: number;
}

export interface ImageGenerationRequest {
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

const SIZE_SUGGESTIONS = ["1024x1024", "16:9", "4:3", "3:4", "9:16", "横版", "竖版", "方形"];
const QUALITY_SUGGESTIONS = ["自动", "草稿", "高质量", "电影感", "细节丰富", "适合社交媒体"];
const MAX_REFERENCE_IMAGES = 10;

export function appendImageGenerationConstraints(prompt: string, size: string, quality: string) {
  const constraints = [
    size.trim() ? `尺寸或比例：${size.trim()}` : "",
    quality.trim() ? `质量偏好：${quality.trim()}` : "",
  ].filter(Boolean);

  return constraints.length > 0
    ? `${prompt.trim()}\n\n【生成参考】${constraints.join("；")}。`
    : prompt.trim();
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
    const [prompt, setPrompt] = useState("");
    const [panel, setPanel] = useState<"generate" | "recognize">("generate");
    const [references, setReferences] = useState<ImageReference[]>([]);
    const [size, setSize] = useState("");
    const [quality, setQuality] = useState("");
    const [group, setGroup] = useState("");
    const [referenceAddOpen, setReferenceAddOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const addReferenceImages = useCallback((images: Array<ImageReference | string>) => {
      const additions = normalizeReferences(images);
      if (additions.length === 0) return;

      setReferences((current) => {
        const merged = normalizeReferences([...current, ...additions]);
        if (merged.length > MAX_REFERENCE_IMAGES) {
          message.warning(`最多支持 ${MAX_REFERENCE_IMAGES} 张参考图`);
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

    const handleSubmit = async () => {
      if (!prompt.trim()) {
        message.warning("请输入提示词");
        return;
      }

      setSubmitting(true);
      try {
        const images = references.map((reference) => reference.url);
        const result = await onSubmit({
          prompt: appendImageGenerationConstraints(prompt, size, quality),
          ...(images.length > 0 ? { image: images[0], images } : {}),
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

    const handleReferenceAdded = (reference: AddedImageReference) => {
      addReferenceImages([reference]);
    };

    return (
      <div className="flex flex-col gap-4">
        <Segmented
          block
          value={panel}
          onChange={(value) => setPanel(value as "generate" | "recognize")}
          options={[
            { value: "generate", label: "图片生成", icon: <PictureOutlined /> },
            { value: "recognize", label: "图片识别", icon: <ScanOutlined /> },
          ]}
        />
        {panel === "recognize" ? <ImageRecognitionWorkbench /> : <>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-sm font-medium text-slate-700">参考图（可选）</div>
          <p className="mb-2 text-xs text-slate-500">不添加参考图时生成新图；添加参考图后，会根据提示词生成修改后的图片。</p>
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
              不添加参考图也可以直接生成
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">图片提示词</label>
          <Input.TextArea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="描述你想生成的图片；如果添加了参考图，也可以描述希望如何修改"
            rows={5}
            maxLength={32000}
            showCount
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">尺寸或比例（可选）</label>
            <AutoComplete
              className="w-full"
              value={size}
              onChange={setSize}
              options={SIZE_SUGGESTIONS.map((value) => ({ value }))}
              placeholder="如 16:9、1024x1024、竖版"
              allowClear
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">质量偏好（可选）</label>
            <AutoComplete
              className="w-full"
              value={quality}
              onChange={setQuality}
              options={QUALITY_SUGGESTIONS.map((value) => ({ value }))}
              placeholder="如高质量、电影感、草稿"
              allowClear
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">分组</label>
          <Input value={group} onChange={(event) => setGroup(event.target.value)} placeholder="如：封面图、参考图" maxLength={60} />
        </div>

        {extra}

        <Button type="primary" icon={<SendOutlined />} loading={submitting} disabled={!prompt.trim()} onClick={handleSubmit} block size="large">
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
