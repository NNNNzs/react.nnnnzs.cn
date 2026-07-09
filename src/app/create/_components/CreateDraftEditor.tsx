"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Empty,
  Image,
  Input,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Tag,
  Tooltip,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileTextOutlined,
  HolderOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { CreateAgentPanel } from "./CreateAgentPanel";
import { useCreateAgent } from "./useCreateAgent";
import { ContentDiffViewer } from "@/components/diff/ContentDiffViewer";
import type { DraftPatch } from "@/services/ai/tools/create-tools/draft-patch";

interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface PageResult<T> {
  record: T[];
  total: number;
  pageNum: number;
  pageSize: number;
}

interface DraftImageItem {
  id: string;
  assetId: number;
  title: string | null;
  imageUrl: string;
  group: string | null;
  sortOrder: number;
  remark: string | null;
  addedAt: string;
}

interface DraftRecord {
  id: number;
  title: string;
  body?: string | null;
  type: string;
  status: string;
  updated_at: string;
  selected_images: DraftImageItem[];
}

interface ImageJobView {
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  imageUrl: string | null;
}

interface ImageAssetRecord {
  id: number;
  title?: string | null;
  usage?: string | null;
  cdn_url?: string | null;
  image_job?: ImageJobView | null;
  created_at: string;
}

const DRAFT_TYPE_OPTIONS = [
  { label: "图文笔记", value: "note" },
  { label: "短视频脚本", value: "short_video" },
  { label: "清单", value: "checklist" },
  { label: "问答", value: "faq" },
];

const DRAFT_STATUS_OPTIONS = [
  { label: "草稿", value: "DRAFT" },
  { label: "素材待处理", value: "ASSET_PENDING" },
  { label: "就绪", value: "READY" },
  { label: "已发布", value: "PUBLISHED" },
  { label: "归档", value: "ARCHIVED" },
];

const typeLabel = new Map(DRAFT_TYPE_OPTIONS.map((option) => [option.value, option.label]));
const statusLabel = new Map(DRAFT_STATUS_OPTIONS.map((option) => [option.value, option.label]));
const FALLBACK_IMAGE = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YxZjVmOSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTRhM2I4IiBmb250LXNpemU9IjE0Ij7lm77niYfliqDovb3lpLHotKU8L3RleHQ+PC9zdmc+";

async function requestApi<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const payload = await response.json() as ApiResponse<T>;

  if (!response.ok || !payload.status) {
    throw new Error(payload.message || "请求失败");
  }

  return payload.data;
}

function getAssetImageUrl(asset: ImageAssetRecord) {
  if (asset.image_job && asset.image_job.status !== "SUCCESS") return null;
  return asset.image_job?.imageUrl || asset.cdn_url || null;
}

function getAssetTitle(asset: ImageAssetRecord) {
  return asset.title || `图片 #${asset.id}`;
}

function sortDraftImages(images: DraftImageItem[]) {
  return [...images].sort((left, right) => (
    left.sortOrder - right.sortOrder
    || left.addedAt.localeCompare(right.addedAt)
    || left.id.localeCompare(right.id)
  ));
}

function normalizeDraftImages(images: DraftImageItem[]) {
  return sortDraftImages(images).map((image, index) => ({
    ...image,
    sortOrder: index + 1,
  }));
}

function getDownloadFileName(disposition: string | null) {
  if (!disposition) return null;

  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1]);
    } catch {
      return null;
    }
  }

  const plainMatch = disposition.match(/filename="([^"]+)"/i);
  return plainMatch?.[1] ?? null;
}

interface DraftPatchDiff {
  oldValue: string;
  newValue: string;
  fields: string[];
}

function formatDiffSection(label: string, value: unknown) {
  const text = Array.isArray(value)
    ? value.join("\n")
    : typeof value === "string"
      ? value
      : value == null
        ? ""
        : JSON.stringify(value, null, 2);
  return `## ${label}\n${text || "（空）"}`;
}

function buildDraftPatchDiff(params: {
  patch: DraftPatch;
  title: string;
  body: string;
  status: string;
  selectedImages: DraftImageItem[];
}): DraftPatchDiff {
  const { patch, title, body, status, selectedImages } = params;
  const oldSections: string[] = [];
  const newSections: string[] = [];
  const fields: string[] = [];

  if (patch.title !== undefined) {
    fields.push("标题");
    oldSections.push(formatDiffSection("标题", title));
    newSections.push(formatDiffSection("标题", patch.title));
  }

  if (patch.hook !== undefined) {
    fields.push("Hook");
    oldSections.push(formatDiffSection("Hook", "当前草稿页暂未接入 hook 字段"));
    newSections.push(formatDiffSection("Hook", patch.hook));
  }

  if (patch.body !== undefined) {
    fields.push("正文");
    oldSections.push(formatDiffSection("正文", body));
    newSections.push(formatDiffSection("正文", patch.body));
  }

  if (patch.status !== undefined) {
    fields.push("状态");
    oldSections.push(formatDiffSection("状态", status));
    newSections.push(formatDiffSection("状态", patch.status));
  }

  if (patch.tags !== undefined) {
    fields.push("标签");
    oldSections.push(formatDiffSection("标签", "当前草稿页暂未接入 tags 字段"));
    newSections.push(formatDiffSection("标签", patch.tags));
  }

  if (patch.addImages?.length) {
    fields.push("图片");
    oldSections.push(formatDiffSection(
      "图片",
      selectedImages.map((image) => `${image.sortOrder}. ${image.title || image.imageUrl}`),
    ));
    newSections.push(formatDiffSection(
      "图片",
      [
        ...selectedImages.map((image) => `${image.sortOrder}. ${image.title || image.imageUrl}`),
        ...patch.addImages.map((image, index) => (
          `新增 ${index + 1}. ${image.title || image.imageUrl}${image.assetId ? ` (#${image.assetId})` : ""}`
        )),
      ],
    ));
  }

  return {
    oldValue: oldSections.join("\n\n"),
    newValue: newSections.join("\n\n"),
    fields,
  };
}

export function CreateDraftEditor() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const draftId = Number(params.id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DraftRecord | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("note");
  const [status, setStatus] = useState("DRAFT");
  const [assetOpen, setAssetOpen] = useState(false);
  const [assetQuery, setAssetQuery] = useState("");
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetData, setAssetData] = useState<PageResult<ImageAssetRecord> | null>(null);
  const [imageSaving, setImageSaving] = useState(false);
  const [downloadingImages, setDownloadingImages] = useState(false);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [pendingPatch, setPendingPatch] = useState<DraftPatch | null>(null);
  const [patchOpen, setPatchOpen] = useState(false);
  const [patchApplying, setPatchApplying] = useState(false);
  const selectedImages = useMemo(() => normalizeDraftImages(draft?.selected_images ?? []), [draft?.selected_images]);
  const pendingPatchDiff = useMemo(() => (
    pendingPatch
      ? buildDraftPatchDiff({ patch: pendingPatch, title, body, status, selectedImages })
      : null
  ), [body, pendingPatch, selectedImages, status, title]);

  const loadDraft = useCallback(async () => {
    if (!Number.isInteger(draftId) || draftId <= 0) return;
    setLoading(true);
    try {
      const result = await requestApi<DraftRecord>(`/api/create/drafts/${draftId}`);
      setDraft(result);
      setTitle(result.title);
      setBody(result.body ?? "");
      setType(result.type);
      setStatus(result.status);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载草稿失败");
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  const loadAssets = useCallback(async () => {
    setAssetLoading(true);
    try {
      const searchParams = new URLSearchParams({ pageSize: "40" });
      if (assetQuery.trim()) searchParams.set("query", assetQuery.trim());
      setAssetData(await requestApi<PageResult<ImageAssetRecord>>(`/api/create/assets?${searchParams.toString()}`));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载素材失败");
    } finally {
      setAssetLoading(false);
    }
  }, [assetQuery]);

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  useEffect(() => {
    if (assetOpen) {
      void loadAssets();
    }
  }, [assetOpen, loadAssets]);

  const hasChanges = useMemo(() => (
    Boolean(draft)
    && (
      title !== draft?.title
      || body !== (draft?.body ?? "")
      || type !== draft?.type
      || status !== draft?.status
    )
  ), [body, draft, status, title, type]);

  const handleSave = async () => {
    if (!title.trim()) {
      message.warning("请输入草稿标题");
      return;
    }

    setSaving(true);
    try {
      const result = await requestApi<DraftRecord>(`/api/create/drafts/${draftId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          body,
          type,
          status,
        }),
      });
      setDraft(result);
      setTitle(result.title);
      setBody(result.body ?? "");
      setType(result.type);
      setStatus(result.status);
      message.success("草稿已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存草稿失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await requestApi(`/api/create/drafts/${draftId}`, {
        method: "DELETE",
      });
      message.success("草稿已删除");
      router.push("/create/drafts");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除草稿失败");
    }
  };

  const applyAgentPatch = useCallback(
    async (patch: DraftPatch) => {
      if (patch.title !== undefined) setTitle(patch.title);
      if (patch.body !== undefined) setBody(patch.body);
      if (patch.status !== undefined) setStatus(patch.status);

      if (patch.addImages?.length) {
        for (const img of patch.addImages) {
          if (!img.assetId) continue;
          try {
            const result = await requestApi<DraftRecord>(
              `/api/create/drafts/${draftId}/images`,
              {
                method: "POST",
                body: JSON.stringify({ asset_id: img.assetId }),
              },
            );
            // 只合并图片快照，不整体覆盖 draft（result 的 title/body 是 DB 旧值，
            // 整体覆盖会让刚 patch 进 title/body state 的内容与 draft 失配）
            setDraft((current) =>
              current ? { ...current, selected_images: result.selected_images } : result,
            );
          } catch (error) {
            console.error("[agent] 回填图片失败:", error);
          }
        }
        message.success(`AI 已追加 ${patch.addImages.length} 张图片`);
      }
    },
    [draftId],
  );

  /**
   * 收到 emit_draft_patch 后先进入待确认状态，不直接改表单。
   */
  const handleAgentPatch = useCallback((patch: DraftPatch) => {
    setPendingPatch(patch);
    message.info("收到 AI 草稿建议，可点击查看对比", 2);
  }, []);

  const handleApplyPendingPatch = useCallback(async () => {
    if (!pendingPatch) return;
    setPatchApplying(true);
    try {
      await applyAgentPatch(pendingPatch);
      setPatchOpen(false);
      setPendingPatch(null);
      message.success("AI 建议已应用到表单，请确认后保存");
    } finally {
      setPatchApplying(false);
    }
  }, [applyAgentPatch, pendingPatch]);

  const agent = useCreateAgent({ draftId, onPatch: handleAgentPatch });

  const handleAddAsset = async (asset: ImageAssetRecord) => {
    const imageUrl = getAssetImageUrl(asset);
    if (!imageUrl) {
      message.warning("图片完成后才能添加到草稿");
      return;
    }

    try {
      const result = await requestApi<DraftRecord>(`/api/create/drafts/${draftId}/images`, {
        method: "POST",
        body: JSON.stringify({ asset_id: asset.id }),
      });
      setDraft(result);
      message.success("图片已添加");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "添加图片失败");
    }
  };

  const handleRemoveImage = async (imageId: string) => {
    try {
      const result = await requestApi<DraftRecord>(`/api/create/drafts/${draftId}/images?imageId=${encodeURIComponent(imageId)}`, {
        method: "DELETE",
      });
      setDraft(result);
      message.success("图片已移除");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "移除图片失败");
    }
  };

  const updateImagesLocally = (images: DraftImageItem[]) => {
    const nextImages = normalizeDraftImages(images);
    setDraft((current) => (current ? { ...current, selected_images: nextImages } : current));
    return nextImages;
  };

  const persistDraftImages = async (images: DraftImageItem[], successMessage?: string) => {
    const nextImages = normalizeDraftImages(images);
    setImageSaving(true);
    try {
      const result = await requestApi<DraftRecord>(`/api/create/drafts/${draftId}/images`, {
        method: "PATCH",
        body: JSON.stringify({
          images: nextImages.map((image) => ({
            id: image.id,
            sort_order: image.sortOrder,
            remark: image.remark,
          })),
        }),
      });
      setDraft(result);
      if (successMessage) {
        message.success(successMessage);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存图片设置失败");
    } finally {
      setImageSaving(false);
    }
  };

  const handleRemarkChange = (imageId: string, remark: string) => {
    updateImagesLocally(
      selectedImages.map((image) => (
        image.id === imageId ? { ...image, remark } : image
      )),
    );
  };

  const handleRemarkBlur = (imageId: string, remark: string) => {
    const nextImages = updateImagesLocally(
      selectedImages.map((image) => (
        image.id === imageId ? { ...image, remark } : image
      )),
    );
    void persistDraftImages(nextImages);
  };

  const handleImageDragStart = (event: React.DragEvent<HTMLElement>, imageId: string) => {
    if (imageSaving) return;
    setDraggingImageId(imageId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", imageId);
  };

  const handleImageDrop = (event: React.DragEvent<HTMLElement>, targetImageId: string) => {
    event.preventDefault();
    const sourceImageId = draggingImageId || event.dataTransfer.getData("text/plain");
    setDraggingImageId(null);

    if (!sourceImageId || sourceImageId === targetImageId || imageSaving) {
      return;
    }

    const sourceIndex = selectedImages.findIndex((image) => image.id === sourceImageId);
    const targetIndex = selectedImages.findIndex((image) => image.id === targetImageId);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const nextImages = [...selectedImages];
    const [movedImage] = nextImages.splice(sourceIndex, 1);
    if (!movedImage) {
      return;
    }
    nextImages.splice(targetIndex, 0, movedImage);
    const normalizedImages = updateImagesLocally(nextImages);
    void persistDraftImages(normalizedImages, "图片顺序已保存");
  };

  const handleDownloadImages = async () => {
    if (selectedImages.length === 0) {
      message.warning("暂无图片可下载");
      return;
    }

    setDownloadingImages(true);
    try {
      const response = await fetch(`/api/create/drafts/${draftId}/images/download`, {
        cache: "no-store",
      });

      if (!response.ok) {
        let errorMessage = "下载失败";
        try {
          const payload = await response.json() as { message?: string };
          errorMessage = payload.message || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = getDownloadFileName(response.headers.get("content-disposition")) || `draft-${draftId}-images.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      message.success("图片包已开始下载");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "下载失败");
    } finally {
      setDownloadingImages(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full overflow-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="h-full overflow-auto">
        <div className="mx-auto w-full max-w-4xl rounded-md border border-dashed border-slate-300 bg-white py-12">
          <Empty description="草稿不存在" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Tag color="blue">{statusLabel.get(status) ?? status}</Tag>
              <Tag>{typeLabel.get(type) ?? type}</Tag>
              <Tag color="green">{selectedImages.length} 张图片</Tag>
            </div>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              variant="borderless"
              className="!px-0 !text-2xl !font-semibold !text-slate-950 md:!text-3xl"
              maxLength={255}
            />
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/create/drafts")}>
              返回
            </Button>
            <Button
              type={agentOpen ? "primary" : "default"}
              icon={<RobotOutlined />}
              onClick={() => setAgentOpen((v) => !v)}
            >
              AI 助手
            </Button>
            {pendingPatch ? (
              <Button onClick={() => setPatchOpen(true)}>
                查看 AI 建议
              </Button>
            ) : null}
            <Popconfirm
              title="删除草稿"
              description="删除后无法恢复，确认继续？"
              okText="删除"
              cancelText="取消"
              onConfirm={handleDelete}
            >
              <Button danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={!hasChanges} onClick={handleSave}>
              保存
            </Button>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-medium text-slate-500">类型</div>
                <Select value={type} onChange={setType} options={DRAFT_TYPE_OPTIONS} className="w-full" />
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-slate-500">状态</div>
                <Select value={status} onChange={setStatus} options={DRAFT_STATUS_OPTIONS} className="w-full" />
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
                <FileTextOutlined />
                正文
              </div>
              <Input.TextArea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={18}
                maxLength={100000}
                showCount
                placeholder="写正文"
              />
            </div>
          </div>

          <aside className="rounded-md border border-slate-200 bg-white p-4 xl:sticky xl:top-4 xl:self-start">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <PictureOutlined />
                图片
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  loading={downloadingImages}
                  disabled={selectedImages.length === 0}
                  onClick={handleDownloadImages}
                >
                  打包下载
                </Button>
                <Button size="small" icon={<PlusOutlined />} onClick={() => setAssetOpen(true)}>
                  添加
                </Button>
              </div>
            </div>

            {selectedImages.length > 0 ? (
              <div className="grid gap-3">
                {selectedImages.map((image) => (
                  <article
                    key={image.id}
                    onDragOver={(event) => {
                      if (draggingImageId && draggingImageId !== image.id) {
                        event.preventDefault();
                      }
                    }}
                    onDrop={(event) => handleImageDrop(event, image.id)}
                    className={[
                      "overflow-hidden rounded-md border bg-white transition",
                      draggingImageId === image.id
                        ? "border-blue-300 opacity-70 ring-2 ring-blue-100"
                        : "border-slate-200 hover:border-blue-200",
                    ].join(" ")}
                  >
                    <div className="relative">
                      <Image
                        src={image.imageUrl}
                        alt={image.title ?? `素材 ${image.assetId}`}
                        fallback={FALLBACK_IMAGE}
                        style={{ width: "100%", height: 180, objectFit: "cover" }}
                      />
                      <div className="absolute left-2 top-2 rounded bg-slate-950/75 px-2 py-1 text-xs font-semibold text-white">
                        #{image.sortOrder}
                      </div>
                    </div>
                    <div className="space-y-2 p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-800">
                            {image.title || "未命名素材"}
                          </div>
                          {image.group ? <div className="text-xs text-slate-500">{image.group}</div> : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Tooltip title="拖拽排序">
                            <Button
                              type="text"
                              size="small"
                              icon={<HolderOutlined />}
                              draggable={!imageSaving}
                              disabled={imageSaving}
                              onDragStart={(event) => handleImageDragStart(event, image.id)}
                              onDragEnd={() => setDraggingImageId(null)}
                              className="cursor-grab"
                            />
                          </Tooltip>
                          <Tooltip title="移除图片">
                            <Button
                              danger
                              type="text"
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => handleRemoveImage(image.id)}
                            />
                          </Tooltip>
                        </div>
                      </div>
                      <Input.TextArea
                        value={image.remark ?? ""}
                        onChange={(event) => handleRemarkChange(image.id, event.target.value)}
                        onBlur={(event) => handleRemarkBlur(image.id, event.currentTarget.value)}
                        rows={2}
                        maxLength={500}
                        placeholder={image.sortOrder === 1 ? "封面图备注" : "图片备注"}
                        disabled={imageSaving}
                      />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                暂无图片
              </div>
            )}
          </aside>
        </section>
      </div>

      <Modal
        title="确认 AI 草稿建议"
        open={patchOpen}
        onCancel={() => setPatchOpen(false)}
        onOk={handleApplyPendingPatch}
        okText="应用到表单"
        cancelText="先不应用"
        confirmLoading={patchApplying}
        width="88vw"
        destroyOnHidden
      >
        {pendingPatchDiff ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>改动项目：</span>
              {pendingPatchDiff.fields.map((field) => (
                <Tag key={field} color="blue">{field}</Tag>
              ))}
            </div>
            <ContentDiffViewer
              oldValue={pendingPatchDiff.oldValue}
              newValue={pendingPatchDiff.newValue}
              leftTitle="当前表单"
              rightTitle="AI 建议"
              className="max-h-[65vh] overflow-auto rounded-md border border-slate-200"
            />
          </div>
        ) : (
          <Empty description="暂无可对比的 AI 建议" />
        )}
      </Modal>

      <Modal
        title="添加素材图片"
        open={assetOpen}
        onCancel={() => setAssetOpen(false)}
        footer={null}
        width={920}
        destroyOnHidden
      >
        <div className="mb-4 flex gap-2">
          <Input
            allowClear
            value={assetQuery}
            onChange={(event) => setAssetQuery(event.target.value)}
            placeholder="搜索素材"
          />
          <Button icon={<ReloadOutlined />} onClick={loadAssets}>
            刷新
          </Button>
        </div>

        {assetLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : assetData?.record.length ? (
          <div className="grid max-h-[60vh] gap-3 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
            {assetData.record.map((asset) => {
              const imageUrl = getAssetImageUrl(asset);
              return (
                <article key={asset.id} className="overflow-hidden rounded-md border border-slate-200">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={getAssetTitle(asset)}
                      fallback={FALLBACK_IMAGE}
                      preview={{ mask: "预览" }}
                      style={{ width: "100%", height: 180, objectFit: "cover" }}
                    />
                  ) : (
                    <div className="flex h-[180px] items-center justify-center bg-slate-100 text-sm text-slate-500">
                      生成中
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{getAssetTitle(asset)}</div>
                      {asset.usage ? <div className="text-xs text-slate-500">{asset.usage}</div> : null}
                    </div>
                    <Button size="small" type="primary" disabled={!imageUrl} onClick={() => handleAddAsset(asset)}>
                      添加
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty description="暂无图片素材" />
        )}
      </Modal>

      <CreateAgentPanel
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
        messages={agent.messages}
        isStreaming={agent.isStreaming}
        onSend={(text) => agent.sendMessage(text, agent.messages)}
        onAbort={agent.abort}
        hasPendingPatch={Boolean(pendingPatch)}
        onViewPatch={() => setPatchOpen(true)}
      />
    </div>
  );
}
