"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  message,
} from "antd";
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  LinkOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import ImageGenJobImage, {
  type ImageGenJobSnapshot,
} from "@/components/ImageGen/ImageGenJobImage";
import ImageGenerationComposer, {
  type ImageGenerationComposerHandle,
  type ImageGenerationRequest,
  type ImageReference,
} from "@/components/ImageGen/ImageGenerationComposer";
import ImageAssetAddModal from "@/components/ImageGen/ImageAssetAddModal";
import { ImageOptimizationType } from "@/lib/image";

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
  is_favorite?: boolean;
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

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAssetSource(asset: ImageAssetRecord): AssetSource {
  return asset.image_job ? "generated" : "uploaded";
}

function isFavorite(asset: ImageAssetRecord) {
  return asset.is_favorite === true;
}

function getImageUrl(asset: ImageAssetRecord) {
  if (asset.image_job && asset.image_job.status !== "SUCCESS") return null;
  return asset.image_job?.imageUrl || asset.cdn_url || null;
}

function getAssetPrompt(asset: ImageAssetRecord) {
  return asset.image_job?.prompt || "";
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
  onUseAsReference,
  onAddToDraft,
  onEdit,
  onDelete,
  onToggleFavorite,
  onJobChange,
}: {
  asset: ImageAssetRecord;
  onUseAsReference: (asset: ImageAssetRecord) => void;
  onAddToDraft: (asset: ImageAssetRecord) => void;
  onEdit: (asset: ImageAssetRecord) => void;
  onDelete: (asset: ImageAssetRecord) => void;
  onToggleFavorite: (asset: ImageAssetRecord) => void;
  onJobChange: (assetId: number, job: ImageGenJobSnapshot) => void;
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
        <ImageGenJobImage
          job={asset.image_job ? {
            jobId: asset.image_job.jobId,
            status: asset.image_job.status,
            ready: asset.image_job.ready,
            imageUrl,
            reservedCdnUrl: asset.image_job.reservedCdnUrl,
            cdnUrl: asset.image_job.cdnUrl,
            errorMessage: asset.image_job.errorMessage,
            elapsed: asset.image_job.elapsed,
          } : null}
          imageUrl={imageUrl}
          alt={title}
          optimizationType={ImageOptimizationType.POST_CARD_COVER}
          onJobChange={(job) => onJobChange(asset.id, job)}
          className="h-full w-full"
        />
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
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">{formatDate(asset.created_at)}</span>
          <Space size={4}>
            <Tooltip title="作为参考图">
              <Button
                size="small"
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
            <Popconfirm
              title="删除图片素材"
              description="仅删除素材记录，图片文件不会从 COS 删除。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => onDelete(asset)}
            >
              <Tooltip title="删除素材">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
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
  const [referenceAssetIds, setReferenceAssetIds] = useState<number[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<ImageAssetRecord | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editGroup, setEditGroup] = useState("");
  const [draftPickerOpen, setDraftPickerOpen] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftData, setDraftData] = useState<PageResult<DraftRecord> | null>(null);
  const [targetAsset, setTargetAsset] = useState<ImageAssetRecord | null>(null);
  const generationComposerRef = useRef<ImageGenerationComposerHandle>(null);
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

  const handleUseAsReference = useCallback((asset: ImageAssetRecord) => {
    const imageUrl = getImageUrl(asset);
    if (!imageUrl) {
      message.warning("图片完成后才能作为参考图");
      return;
    }
    generationComposerRef.current?.addReferenceImages([{
      url: imageUrl,
      title: getAssetTitle(asset),
      assetId: asset.id,
    }]);
    message.success("已添加为参考图");
  }, []);

  const submitAssetGeneration = useCallback(async (params: ImageGenerationRequest) => (
    requestJson<GenerateAssetResponse>("/api/create/assets/generate", {
      method: "POST",
      body: JSON.stringify({
        ...params,
        reference_asset_ids: params.mode === "edit" ? referenceAssetIds : undefined,
      }),
    })
  ), [referenceAssetIds]);

  const handleReferencesChange = useCallback((references: ImageReference[]) => {
    setReferenceAssetIds(references
      .map((reference) => reference.assetId)
      .filter((assetId): assetId is number => typeof assetId === "number"));
  }, []);


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

  const handleDeleteAsset = async (asset: ImageAssetRecord) => {
    try {
      await requestJson<null>(`/api/create/assets/${asset.id}`, { method: "DELETE" });
      message.success("图片素材已删除");
      await loadAssets();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除图片素材失败");
    }
  };

  const handleAssetJobChange = useCallback((assetId: number, job: ImageGenJobSnapshot) => {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        record: current.record.map((asset) => {
          if (asset.id !== assetId || !asset.image_job) return asset;
          return {
            ...asset,
            image_job: {
              ...asset.image_job,
              status: (job.status || asset.image_job.status) as ImageJobView["status"],
              ready: job.ready ?? asset.image_job.ready,
              imageUrl: job.status === "SUCCESS" ? job.imageUrl || job.cdnUrl || asset.image_job.imageUrl : asset.image_job.imageUrl,
              reservedCdnUrl: job.reservedCdnUrl || asset.image_job.reservedCdnUrl,
              cdnUrl: job.cdnUrl || asset.image_job.cdnUrl,
              errorMessage: job.errorMessage ?? asset.image_job.errorMessage,
              elapsed: job.elapsed || asset.image_job.elapsed,
            },
          };
        }),
      };
    });
  }, []);

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
              添加素材
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
                    onUseAsReference={handleUseAsReference}
                    onAddToDraft={openDraftPicker}
                    onEdit={openEdit}
                    onDelete={handleDeleteAsset}
                    onToggleFavorite={handleToggleFavorite}
                    onJobChange={handleAssetJobChange}
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
            <ImageGenerationComposer
              ref={generationComposerRef}
              onSubmit={submitAssetGeneration}
              onSuccess={() => { void loadAssets(); }}
              onReferencesChange={handleReferencesChange}
            />
          </aside>
        </section>
      </div>

      <ImageAssetAddModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onAssetAdded={() => { void loadAssets(); }}
      />

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
            <Space.Compact className="w-full">
              <Button disabled>CDN</Button>
              <Input value={editingAsset.cdn_url} disabled />
            </Space.Compact>
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
