"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Empty,
  Image,
  Input,
  Modal,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Upload,
  message,
} from "antd";
import type { UploadProps } from "antd";
import {
  CopyOutlined,
  EditOutlined,
  FileTextOutlined,
  LinkOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  StarFilled,
  StarOutlined,
  UploadOutlined,
} from "@ant-design/icons";

type AssetSource = "generated" | "uploaded";
type SourceFilter = "all" | AssetSource;
type ImageMode = "generate" | "edit";

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

interface AssetMetadata {
  source?: AssetSource;
  isFavorite?: boolean;
  prompt?: string;
  mode?: ImageMode;
  size?: string;
  quality?: string;
  jobId?: string;
  originalFilename?: string;
  mimeType?: string;
}

interface ImageJobView {
  id: number;
  jobId: string;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  ready: boolean;
  imageUrl: string | null;
  reservedCdnUrl: string | null;
  cdnUrl: string | null;
  cosKey: string | null;
  prompt: string;
  mode: ImageMode;
  size: string | null;
  quality: string | null;
  elapsed: string | null;
  errorMessage: string | null;
}

interface ImageAssetRecord {
  id: number;
  title?: string | null;
  type: string;
  usage?: string | null;
  cdn_url?: string | null;
  cos_key?: string | null;
  metadata_json?: Record<string, unknown> | null;
  asset_metadata?: AssetMetadata | null;
  image_job?: ImageJobView | null;
  created_at: string;
}

interface GenerateAssetResponse {
  asset: ImageAssetRecord;
  job: ImageJobView;
}

interface DraftRecord {
  id: number;
  title: string;
  type: string;
  status: string;
  updated_at: string;
  selected_images?: Array<{
    id: string;
    assetId: number;
    imageUrl: string;
  }>;
}

const SIZE_OPTIONS = [
  { value: "1024x1024", label: "1024×1024" },
  { value: "1792x1024", label: "1792×1024" },
  { value: "1024x1792", label: "1024×1792" },
];

const QUALITY_OPTIONS = [
  { value: "high", label: "高质量" },
  { value: "medium", label: "中等" },
  { value: "low", label: "草稿" },
  { value: "auto", label: "自动" },
];

const SOURCE_LABEL: Record<AssetSource, string> = {
  generated: "生成",
  uploaded: "上传",
};

const STATUS_LABEL: Record<ImageJobView["status"], string> = {
  PENDING: "排队中",
  PROCESSING: "处理中",
  SUCCESS: "已完成",
  FAILED: "失败",
};

const STATUS_COLOR: Record<ImageJobView["status"], string> = {
  PENDING: "gold",
  PROCESSING: "blue",
  SUCCESS: "green",
  FAILED: "red",
};

const FALLBACK_IMAGE = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YxZjVmOSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTRhM2I4IiBmb250LXNpemU9IjE0Ij7lm77niYfliqDovb3lpLHotKU8L3RleHQ+PC9zdmc+";

async function requestJson<T>(url: string, options?: RequestInit) {
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

async function requestForm<T>(url: string, formData: FormData) {
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    body: formData,
  });
  const payload = await response.json() as ApiResponse<T>;

  if (!response.ok || !payload.status) {
    throw new Error(payload.message || "请求失败");
  }

  return payload.data;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAssetMetadata(asset: ImageAssetRecord): AssetMetadata {
  if (asset.asset_metadata) return asset.asset_metadata;
  const metadata = asset.metadata_json;
  if (!metadata || typeof metadata !== "object") return {};
  return {
    source: metadata.source === "uploaded" ? "uploaded" : metadata.source === "generated" ? "generated" : undefined,
    isFavorite: typeof metadata.isFavorite === "boolean" ? metadata.isFavorite : undefined,
    prompt: typeof metadata.prompt === "string" ? metadata.prompt : undefined,
    mode: metadata.mode === "edit" ? "edit" : metadata.mode === "generate" ? "generate" : undefined,
    size: typeof metadata.size === "string" ? metadata.size : undefined,
    quality: typeof metadata.quality === "string" ? metadata.quality : undefined,
    jobId: typeof metadata.jobId === "string" ? metadata.jobId : undefined,
    originalFilename: typeof metadata.originalFilename === "string" ? metadata.originalFilename : undefined,
    mimeType: typeof metadata.mimeType === "string" ? metadata.mimeType : undefined,
  };
}

function getAssetSource(asset: ImageAssetRecord): AssetSource {
  return getAssetMetadata(asset).source ?? (asset.image_job ? "generated" : "uploaded");
}

function isFavorite(asset: ImageAssetRecord) {
  return getAssetMetadata(asset).isFavorite === true;
}

function getImageUrl(asset: ImageAssetRecord) {
  if (asset.image_job && asset.image_job.status !== "SUCCESS") return null;
  return asset.image_job?.imageUrl || asset.cdn_url || null;
}

function getAssetPrompt(asset: ImageAssetRecord) {
  return asset.image_job?.prompt || getAssetMetadata(asset).prompt || "";
}

function getAssetTitle(asset: ImageAssetRecord) {
  return asset.title || getAssetPrompt(asset).slice(0, 32) || `图片 #${asset.id}`;
}

function isRunning(asset: ImageAssetRecord) {
  return asset.image_job?.status === "PENDING" || asset.image_job?.status === "PROCESSING";
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton.Node
          key={index}
          active
          className="!h-[340px] !w-full !rounded-md"
        />
      ))}
    </div>
  );
}

function AssetCard({
  asset,
  isReference,
  onUseAsReference,
  onAddToDraft,
  onEdit,
  onToggleFavorite,
}: {
  asset: ImageAssetRecord;
  isReference: boolean;
  onUseAsReference: (asset: ImageAssetRecord) => void;
  onAddToDraft: (asset: ImageAssetRecord) => void;
  onEdit: (asset: ImageAssetRecord) => void;
  onToggleFavorite: (asset: ImageAssetRecord) => void;
}) {
  const imageUrl = getImageUrl(asset);
  const source = getAssetSource(asset);
  const favorite = isFavorite(asset);
  const title = getAssetTitle(asset);
  const prompt = getAssetPrompt(asset);
  const canReference = Boolean(imageUrl);

  const handleCopy = () => {
    if (!imageUrl) return;
    void navigator.clipboard.writeText(imageUrl).then(
      () => message.success("已复制图片地址"),
      () => message.error("复制失败"),
    );
  };

  return (
    <article className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition-colors hover:border-slate-300">
      <div className="relative aspect-[4/5] bg-slate-100">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            preview={{ mask: "预览" }}
            fallback={FALLBACK_IMAGE}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            wrapperStyle={{ width: "100%", height: "100%" }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
            <PictureOutlined className="text-3xl" />
            <span className="text-sm">
              {asset.image_job ? STATUS_LABEL[asset.image_job.status] : "等待图片"}
            </span>
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <Tag color={source === "generated" ? "geekblue" : "green"} className="m-0">
            {SOURCE_LABEL[source]}
          </Tag>
          {asset.image_job ? (
            <Tag color={STATUS_COLOR[asset.image_job.status]} className="m-0">
              {STATUS_LABEL[asset.image_job.status]}
            </Tag>
          ) : null}
        </div>
        <Tooltip title={favorite ? "取消收藏" : "收藏"}>
          <Button
            shape="circle"
            size="small"
            icon={favorite ? <StarFilled /> : <StarOutlined />}
            className="absolute right-2 top-2"
            onClick={() => onToggleFavorite(asset)}
          />
        </Tooltip>
      </div>

      <div className="flex min-h-[150px] flex-col gap-3 p-3">
        <div className="min-w-0">
          <div className="line-clamp-1 text-sm font-semibold text-slate-950" title={title}>
            {title}
          </div>
          {prompt ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500" title={prompt}>
              {prompt}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1 text-xs">
          {asset.usage ? <Tag className="m-0">{asset.usage}</Tag> : <Tag className="m-0">未分组</Tag>}
          {asset.image_job?.size ? <Tag className="m-0">{asset.image_job.size}</Tag> : null}
          {asset.image_job?.quality ? <Tag className="m-0">{asset.image_job.quality}</Tag> : null}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">{formatDate(asset.created_at)}</span>
          <Space size={4}>
            <Tooltip title={isReference ? "移出母图" : "作为母图"}>
              <Button
                size="small"
                type={isReference ? "primary" : "default"}
                icon={<PictureOutlined />}
                disabled={!canReference}
                onClick={() => onUseAsReference(asset)}
              />
            </Tooltip>
            <Tooltip title="添加到草稿">
              <Button
                size="small"
                icon={<FileTextOutlined />}
                disabled={!canReference}
                onClick={() => onAddToDraft(asset)}
              />
            </Tooltip>
            <Tooltip title="改名/分组">
              <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(asset)} />
            </Tooltip>
            <Tooltip title="复制地址">
              <Button size="small" icon={<CopyOutlined />} disabled={!imageUrl} onClick={handleCopy} />
            </Tooltip>
            <Tooltip title="打开">
              <Button
                size="small"
                icon={<LinkOutlined />}
                disabled={!imageUrl}
                onClick={() => imageUrl && window.open(imageUrl, "_blank")}
              />
            </Tooltip>
          </Space>
        </div>
      </div>
    </article>
  );
}

export function CreateImageAssetsManager() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PageResult<ImageAssetRecord> | null>(null);
  const [mode, setMode] = useState<ImageMode>("generate");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("high");
  const [group, setGroup] = useState("");
  const [references, setReferences] = useState<ImageAssetRecord[]>([]);
  const [generating, setGenerating] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadGroup, setUploadGroup] = useState("");
  const [editingAsset, setEditingAsset] = useState<ImageAssetRecord | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editGroup, setEditGroup] = useState("");
  const [draftPickerOpen, setDraftPickerOpen] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftData, setDraftData] = useState<PageResult<DraftRecord> | null>(null);
  const [targetAsset, setTargetAsset] = useState<ImageAssetRecord | null>(null);
  const records = useMemo(() => data?.record ?? [], [data?.record]);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "60" });
      if (query.trim()) params.set("query", query.trim());
      if (source !== "all") params.set("source", source);
      if (favoriteOnly) params.set("favorite", "true");
      setData(await requestJson<PageResult<ImageAssetRecord>>(`/api/create/assets?${params.toString()}`));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载图片素材失败");
    } finally {
      setLoading(false);
    }
  }, [favoriteOnly, query, source]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const loadDraftCandidates = useCallback(async () => {
    setDraftLoading(true);
    try {
      const params = new URLSearchParams({
        pageSize: "60",
        status: "DRAFT",
      });
      setDraftData(await requestJson<PageResult<DraftRecord>>(`/api/create/drafts?${params.toString()}`));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载草稿失败");
    } finally {
      setDraftLoading(false);
    }
  }, []);

  useEffect(() => {
    if (draftPickerOpen) {
      void loadDraftCandidates();
    }
  }, [draftPickerOpen, loadDraftCandidates]);

  const hasRunningJob = useMemo(() => records.some(isRunning), [records]);

  useEffect(() => {
    if (!hasRunningJob) return undefined;
    const timer = window.setInterval(() => {
      void loadAssets();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [hasRunningJob, loadAssets]);

  const stats = useMemo(() => ({
    total: data?.total ?? 0,
    generated: records.filter((asset) => getAssetSource(asset) === "generated").length,
    uploaded: records.filter((asset) => getAssetSource(asset) === "uploaded").length,
    favorite: records.filter(isFavorite).length,
    running: records.filter(isRunning).length,
  }), [data?.total, records]);

  const referenceIds = useMemo(() => new Set(references.map((asset) => asset.id)), [references]);
  const referenceUrls = useMemo(
    () => references.map(getImageUrl).filter((url): url is string => Boolean(url)),
    [references],
  );

  const handleUseAsReference = useCallback((asset: ImageAssetRecord) => {
    if (!getImageUrl(asset)) {
      message.warning("图片完成后才能作为母图");
      return;
    }

    setMode("edit");
    setReferences((current) => {
      if (current.some((item) => item.id === asset.id)) {
        return current.filter((item) => item.id !== asset.id);
      }
      return [...current, asset].slice(-10);
    });
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      message.warning("请输入提示词");
      return;
    }
    if (mode === "edit" && referenceUrls.length === 0) {
      message.warning("图文编辑需要先选择母图");
      return;
    }

    setGenerating(true);
    try {
      await requestJson<GenerateAssetResponse>("/api/create/assets/generate", {
        method: "POST",
        body: JSON.stringify({
          mode,
          prompt: prompt.trim(),
          size,
          quality,
          group: group.trim() || undefined,
          images: mode === "edit" ? referenceUrls : undefined,
          reference_asset_ids: mode === "edit" ? references.map((asset) => asset.id) : undefined,
        }),
      });
      message.success("图片任务已提交");
      setPrompt("");
      await loadAssets();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "提交图片任务失败");
    } finally {
      setGenerating(false);
    }
  };

  const uploadProps: UploadProps = {
    accept: "image/*",
    maxCount: 1,
    beforeUpload: (file) => {
      setUploadFile(file);
      if (!uploadTitle.trim()) {
        setUploadTitle(file.name.replace(/\.[^.]+$/, ""));
      }
      return false;
    },
    onRemove: () => {
      setUploadFile(null);
      return true;
    },
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      message.warning("请选择图片");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("inputFile", uploadFile);
      if (uploadTitle.trim()) formData.append("title", uploadTitle.trim());
      if (uploadGroup.trim()) formData.append("group", uploadGroup.trim());
      await requestForm<ImageAssetRecord>("/api/create/assets/upload", formData);
      message.success("图片已上传");
      setUploadOpen(false);
      setUploadFile(null);
      setUploadTitle("");
      setUploadGroup("");
      await loadAssets();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上传图片失败");
    } finally {
      setUploading(false);
    }
  };

  const openEdit = (asset: ImageAssetRecord) => {
    setEditingAsset(asset);
    setEditTitle(asset.title ?? "");
    setEditGroup(asset.usage ?? "");
  };

  const handleSaveEdit = async () => {
    if (!editingAsset) return;
    try {
      await requestJson<ImageAssetRecord>(`/api/create/assets/${editingAsset.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle.trim() || null,
          group: editGroup.trim() || null,
        }),
      });
      message.success("图片信息已更新");
      setEditingAsset(null);
      await loadAssets();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "更新图片失败");
    }
  };

  const handleToggleFavorite = async (asset: ImageAssetRecord) => {
    try {
      await requestJson<ImageAssetRecord>(`/api/create/assets/${asset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_favorite: !isFavorite(asset) }),
      });
      await loadAssets();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "更新收藏失败");
    }
  };

  const openDraftPicker = (asset: ImageAssetRecord) => {
    if (!getImageUrl(asset)) {
      message.warning("图片完成后才能添加到草稿");
      return;
    }

    setTargetAsset(asset);
    setDraftPickerOpen(true);
  };

  const handleAddToDraft = async (draftId: number) => {
    if (!targetAsset) return;

    try {
      await requestJson(`/api/create/drafts/${draftId}/images`, {
        method: "POST",
        body: JSON.stringify({ asset_id: targetAsset.id }),
      });
      message.success("图片已添加到草稿");
      await loadDraftCandidates();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "添加到草稿失败");
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              image asset library
            </div>
            <h1 className="text-2xl font-semibold text-slate-950 md:text-3xl">
              素材库
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              图片素材生产、上传、收藏、分组和母图复用集中在这里。
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
              上传图片
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadAssets}>
              刷新
            </Button>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-5">
          <Metric label="图片总数" value={stats.total} />
          <Metric label="生成图片" value={stats.generated} />
          <Metric label="上传图片" value={stats.uploaded} />
          <Metric label="收藏图片" value={stats.favorite} />
          <Metric label="队列中" value={stats.running} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3 lg:flex-row lg:items-center">
              <Input
                allowClear
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="搜索名称、提示词或资源地址"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="lg:max-w-sm"
              />
              <Segmented
                value={source}
                onChange={(value) => setSource(value as SourceFilter)}
                options={[
                  { label: "全部", value: "all" },
                  { label: "生成", value: "generated" },
                  { label: "上传", value: "uploaded" },
                ]}
              />
              <Button
                icon={favoriteOnly ? <StarFilled /> : <StarOutlined />}
                type={favoriteOnly ? "primary" : "default"}
                onClick={() => setFavoriteOnly((value) => !value)}
              >
                收藏
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadAssets}>
                刷新列表
              </Button>
            </div>

            {loading ? (
              <LoadingGrid />
            ) : records.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {records.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    isReference={referenceIds.has(asset.id)}
                    onUseAsReference={handleUseAsReference}
                    onAddToDraft={openDraftPicker}
                    onEdit={openEdit}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-slate-300 bg-white py-12">
                <Empty description="暂无图片素材" />
              </div>
            )}
          </div>

          <aside className="rounded-md border border-slate-200 bg-white p-4 xl:sticky xl:top-4 xl:self-start">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-950">
              <PlusOutlined />
              生成图片
            </div>
            <div className="flex flex-col gap-4">
              <Segmented
                block
                value={mode}
                onChange={(value) => setMode(value as ImageMode)}
                options={[
                  { label: "文生图", value: "generate" },
                  { label: "图文编辑", value: "edit" },
                ]}
              />

              {mode === "edit" ? (
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>母图</span>
                    {references.length > 0 ? (
                      <Button size="small" type="text" onClick={() => setReferences([])}>
                        清空
                      </Button>
                    ) : null}
                  </div>
                  {references.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {references.map((asset) => {
                        const imageUrl = getImageUrl(asset);
                        return imageUrl ? (
                          <button
                            key={asset.id}
                            type="button"
                            className="relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-white"
                            onClick={() => handleUseAsReference(asset)}
                          >
                            <Image
                              src={imageUrl}
                              alt={getAssetTitle(asset)}
                              preview={false}
                              fallback={FALLBACK_IMAGE}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              wrapperStyle={{ width: "100%", height: "100%" }}
                            />
                          </button>
                        ) : null;
                      })}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-slate-300 py-6 text-center text-xs text-slate-500">
                      从图片卡片选择母图
                    </div>
                  )}
                </div>
              ) : null}

              <Input.TextArea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={mode === "edit" ? "输入编辑指令" : "输入图片提示词"}
                rows={5}
                maxLength={32000}
                showCount
              />

              <div className="grid grid-cols-2 gap-3">
                <Select value={size} onChange={setSize} options={SIZE_OPTIONS} />
                <Select value={quality} onChange={setQuality} options={QUALITY_OPTIONS} />
              </div>

              <Input
                value={group}
                onChange={(event) => setGroup(event.target.value)}
                placeholder="分组，如封面图/参考母图"
                maxLength={60}
              />

              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={generating}
                disabled={!prompt.trim() || (mode === "edit" && referenceUrls.length === 0)}
                onClick={handleGenerate}
                block
              >
                提交队列任务
              </Button>
            </div>
          </aside>
        </section>
      </div>

      <Modal
        title="上传图片"
        open={uploadOpen}
        onOk={handleUpload}
        onCancel={() => setUploadOpen(false)}
        confirmLoading={uploading}
        okText="上传"
        destroyOnHidden
      >
        <div className="flex flex-col gap-4">
          <Upload.Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">选择或拖入图片</p>
          </Upload.Dragger>
          <Input
            value={uploadTitle}
            onChange={(event) => setUploadTitle(event.target.value)}
            placeholder="图片名称"
            maxLength={255}
          />
          <Input
            value={uploadGroup}
            onChange={(event) => setUploadGroup(event.target.value)}
            placeholder="分组"
            maxLength={60}
          />
        </div>
      </Modal>

      <Modal
        title="图片信息"
        open={Boolean(editingAsset)}
        onOk={handleSaveEdit}
        onCancel={() => setEditingAsset(null)}
        okText="保存"
        destroyOnHidden
      >
        <div className="flex flex-col gap-4">
          <Input
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            placeholder="图片名称"
            maxLength={255}
          />
          <Input
            value={editGroup}
            onChange={(event) => setEditGroup(event.target.value)}
            placeholder="分组"
            maxLength={60}
          />
          {editingAsset?.cdn_url ? (
            <Input value={editingAsset.cdn_url} disabled addonBefore="CDN" />
          ) : null}
        </div>
      </Modal>

      <Modal
        title="添加到草稿"
        open={draftPickerOpen}
        onCancel={() => setDraftPickerOpen(false)}
        footer={null}
        destroyOnHidden
      >
        {draftLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : draftData?.record.length ? (
          <div className="grid max-h-[56vh] gap-2 overflow-auto">
            {draftData.record.map((draft) => (
              <button
                key={draft.id}
                type="button"
                className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                onClick={() => handleAddToDraft(draft.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{draft.title}</span>
                  <span className="text-xs text-slate-500">{draft.selected_images?.length ?? 0} 张图片</span>
                </span>
                <FileTextOutlined className="text-slate-400" />
              </button>
            ))}
          </div>
        ) : (
          <Empty description="暂无草稿状态的草稿" />
        )}
      </Modal>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}
