"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Tag,
  message,
} from "antd";
import {
  BulbOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { BlogSourceSelector } from "./BlogSourceSelector";
import { ContentDiffViewer } from "@/components/diff/ContentDiffViewer";
import { TopicAgentPanel } from "./TopicAgentPanel";
import { useTopicAgent } from "./useTopicAgent";
import type { TopicPatch } from "@/services/ai/topic-agent";

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

interface TopicRecord {
  id: number;
  title: string;
  source_type?: string;
  source_url?: string | null;
  original_idea?: string | null;
  core_angle?: string | null;
  key_points?: string[] | null;
  dedup_key?: string | null;
  description?: string | null;
  pillar?: string | null;
  series?: string | null;
  status: string;
  priority: number;
  source_post_id?: number | null;
  ai_reason?: string | null;
  updated_at: string;
  _count?: {
    drafts: number;
    assets: number;
  };
}

interface DraftRecord {
  id: number;
  title: string;
  hook?: string | null;
  body?: string | null;
  platform: string;
  type: string;
  status: string;
  updated_at: string;
  selected_images?: DraftImageItem[];
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

interface AssetRecord {
  id: number;
  title?: string | null;
  type: string;
  usage?: string | null;
  cdn_url?: string | null;
  cos_key?: string | null;
  local_path?: string | null;
  created_at: string;
  draft?: {
    id: number;
    title: string;
    status: string;
  } | null;
  topic?: {
    id: number;
    title: string;
  } | null;
}

interface OverviewData {
  stats: {
    draftTotal: number;
    draftReady: number;
    assetTotal: number;
    topicTotal: number;
    topicPlanned: number;
  };
  latestDrafts: DraftRecord[];
  latestAssets: AssetRecord[];
  latestTopics: TopicRecord[];
}

const statusOptions = [
  { label: "全部状态", value: "" },
  { label: "想法", value: "IDEA" },
  { label: "计划中", value: "PLANNED" },
  { label: "起草中", value: "DRAFTING" },
  { label: "草稿", value: "DRAFT" },
  { label: "素材待处理", value: "ASSET_PENDING" },
  { label: "就绪", value: "READY" },
  { label: "已发布", value: "PUBLISHED" },
  { label: "归档", value: "ARCHIVED" },
];

const topicStatusOptions = [
  { label: "全部状态", value: "" },
  { label: "想法", value: "IDEA" },
  { label: "已用于草稿", value: "USED" },
  { label: "归档", value: "ARCHIVED" },
];

const topicSourceOptions = [
  { label: "一句想法", value: "idea" },
  { label: "博客文章", value: "blog" },
  { label: "文章链接", value: "url" },
  { label: "网站资料", value: "website" },
];

const topicDraftPlatformOptions = [
  { label: "小红书图文", value: "xhs" },
  { label: "知乎 Markdown", value: "zhihu" },
];

const topicSourceLabel = new Map(topicSourceOptions.map((option) => [option.value, option.label]));

const topicDiffFields: Array<{
  key: keyof TopicPatch;
  label: string;
  currentKey: keyof TopicRecord;
}> = [
  { key: "title", label: "标题", currentKey: "title" },
  { key: "sourceType", label: "来源类型", currentKey: "source_type" },
  { key: "sourceUrl", label: "来源链接", currentKey: "source_url" },
  { key: "sourcePostId", label: "来源博客 ID", currentKey: "source_post_id" },
  { key: "originalIdea", label: "原始想法", currentKey: "original_idea" },
  { key: "coreAngle", label: "核心角度", currentKey: "core_angle" },
  { key: "keyPoints", label: "关键点", currentKey: "key_points" },
  { key: "status", label: "状态", currentKey: "status" },
];

function formatTopicDiffValue(value: unknown) {
  if (Array.isArray(value)) return value.join("\n");
  if (value === null || value === undefined || value === "") return "（空）";
  return String(value);
}

function buildTopicPatchDiff(topic: TopicRecord | null, patch: TopicPatch) {
  const oldSections: string[] = [];
  const newSections: string[] = [];
  for (const field of topicDiffFields) {
    if (patch[field.key] === undefined) continue;
    oldSections.push(`## ${field.label}\n${formatTopicDiffValue(topic?.[field.currentKey])}`);
    newSections.push(`## ${field.label}\n${formatTopicDiffValue(patch[field.key])}`);
  }
  return {
    oldValue: oldSections.join("\n\n") || "（当前没有选题内容）",
    newValue: newSections.join("\n\n") || "（没有字段变化）",
  };
}

const draftStatusOptions = [
  { label: "全部状态", value: "" },
  { label: "草稿", value: "DRAFT" },
  { label: "素材待处理", value: "ASSET_PENDING" },
  { label: "就绪", value: "READY" },
  { label: "已发布", value: "PUBLISHED" },
  { label: "归档", value: "ARCHIVED" },
];

const draftTypeOptions = [
  { label: "全部类型", value: "" },
  { label: "图文笔记", value: "note" },
  { label: "长文 / Markdown", value: "article" },
  { label: "短视频脚本", value: "short_video" },
  { label: "清单", value: "checklist" },
  { label: "问答", value: "faq" },
];

const draftTypeCreateOptions = draftTypeOptions.filter((option) => option.value);
const draftStatusCreateOptions = draftStatusOptions.filter((option) => option.value);

const draftTypeLabel = new Map(draftTypeOptions.map((option) => [option.value, option.label]));
const draftStatusLabel = new Map(draftStatusOptions.map((option) => [option.value, option.label]));
const draftPlatformCreateOptions = [
  { label: "小红书", value: "xhs" },
  { label: "知乎", value: "zhihu" },
];

async function requestApi<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, {
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

function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
          {eyebrow}
        </div>
        <h1 className="text-2xl font-semibold text-slate-950 md:text-3xl">
          {title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </section>
  );
}

function FilterBar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  onRefresh,
  extra,
  statusOptionsList = statusOptions,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  status?: string;
  onStatusChange?: (value: string) => void;
  onRefresh: () => void;
  extra?: React.ReactNode;
  statusOptionsList?: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3 lg:flex-row lg:items-center">
      <Input
        allowClear
        prefix={<SearchOutlined className="text-slate-400" />}
        placeholder="搜索标题、正文或说明"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        className="lg:max-w-sm"
      />
      {onStatusChange ? (
        <Select
          value={status ?? ""}
          options={statusOptionsList}
          onChange={onStatusChange}
          className="w-full lg:w-40"
        />
      ) : null}
      {extra}
      <Button icon={<ReloadOutlined />} onClick={onRefresh}>
        刷新
      </Button>
    </div>
  );
}

function LoadingList() {
  return (
    <div className="grid gap-3">
      <Skeleton active paragraph={{ rows: 2 }} />
      <Skeleton active paragraph={{ rows: 2 }} />
      <Skeleton active paragraph={{ rows: 2 }} />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white py-12">
      <Empty description={text} />
    </div>
  );
}

export function CreateOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await requestApi<OverviewData>("/api/create/overview"));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载概览失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader
          eyebrow="create priority"
          title="内容创作工作台"
          description="当前阶段聚焦草稿库、素材库和选题库。发布日历、复盘、Remotion 和视频相关能力后置。"
          actions={<Button icon={<ReloadOutlined />} onClick={loadOverview}>刷新</Button>}
        />

        {loading ? (
          <LoadingList />
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-5">
              {[
                ["草稿总数", overview?.stats.draftTotal ?? 0],
                ["就绪草稿", overview?.stats.draftReady ?? 0],
                ["素材总数", overview?.stats.assetTotal ?? 0],
                ["选题总数", overview?.stats.topicTotal ?? 0],
                ["待进入草稿", overview?.stats.topicPlanned ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
                </div>
              ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <RecentPanel title="最近草稿" items={overview?.latestDrafts.map((item) => ({
                key: item.id,
                title: item.title,
                meta: `${item.platform} / ${item.type} / ${item.status}`,
              })) ?? []} />
              <RecentPanel title="最近素材" items={overview?.latestAssets.map((item) => ({
                key: item.id,
                title: item.title || `素材 #${item.id}`,
                meta: `${item.type}${item.usage ? ` / ${item.usage}` : ""}`,
              })) ?? []} />
              <RecentPanel title="最近选题" items={overview?.latestTopics.map((item) => ({
                key: item.id,
                title: item.title,
                meta: `${topicSourceLabel.get(item.source_type || "") || "历史选题"}${item.core_angle ? ` / ${item.core_angle}` : ""}`,
              })) ?? []} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function RecentPanel({
  title,
  items,
}: {
  title: string;
  items: Array<{ key: number; title: string; meta: string }>;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="mb-3 text-sm font-medium text-slate-950">{title}</div>
      <div className="grid gap-2">
        {items.length > 0 ? items.map((item) => (
          <div key={item.key} className="rounded-md bg-slate-50 px-3 py-2">
            <div className="line-clamp-1 text-sm font-medium text-slate-800">{item.title}</div>
            <div className="mt-1 text-xs text-slate-500">{item.meta}</div>
          </div>
        )) : (
          <div className="rounded-md bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            暂无数据
          </div>
        )}
      </div>
    </div>
  );
}

export function CreateTopicsManager() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PageResult<TopicRecord> | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [topicAgentOpen, setTopicAgentOpen] = useState(false);
  const [topicAgentTopic, setTopicAgentTopic] = useState<TopicRecord | null>(null);
  const [pendingTopicPatch, setPendingTopicPatch] = useState<TopicPatch | null>(null);
  const [topicPatchOpen, setTopicPatchOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicRecord | null>(null);
  const [draftTopic, setDraftTopic] = useState<TopicRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [aiForm] = Form.useForm();
  const [draftForm] = Form.useForm();

  const handleTopicAgentPatch = useCallback((patch: TopicPatch) => {
    setPendingTopicPatch(patch);
    message.info("收到 AI 选题建议，可点击查看对比", 2);
  }, []);

  const topicAgent = useTopicAgent({
    topicId: topicAgentTopic?.id,
    onPatch: handleTopicAgentPatch,
  });

  const topicPatchDiff = useMemo(() => (
    pendingTopicPatch ? buildTopicPatchDiff(topicAgentTopic, pendingTopicPatch) : null
  ), [pendingTopicPatch, topicAgentTopic]);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        pageSize: "30",
      });
      if (query.trim()) params.set("query", query.trim());
      if (status) params.set("status", status);
      setData(await requestApi<PageResult<TopicRecord>>(`/api/create/topics?${params.toString()}`));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载选题失败");
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  const handleCreate = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const keyPoints = typeof values.key_points === "string"
        ? values.key_points.split("\n").map((item: string) => item.trim()).filter(Boolean)
        : values.key_points;
      await requestApi(editingTopic ? `/api/create/topics/${editingTopic.id}` : "/api/create/topics", {
        method: editingTopic ? "PATCH" : "POST",
        body: JSON.stringify({ ...values, key_points: keyPoints }),
      });
      message.success(editingTopic ? "选题已保存" : "选题已创建");
      setCreateOpen(false);
      setEditingTopic(null);
      form.resetFields();
      await loadTopics();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建选题失败");
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingTopic(null);
    form.setFieldsValue({ source_type: "idea", status: "IDEA" });
    setCreateOpen(true);
  };

  const openEdit = (topic: TopicRecord) => {
    setEditingTopic(topic);
    form.setFieldsValue({
      ...topic,
      source_type: topic.source_type || (topic.source_post_id ? "blog" : "idea"),
      key_points: topic.key_points?.join("\n"),
    });
    setCreateOpen(true);
  };

  const openTopicAgent = (topic: TopicRecord | null = null) => {
    topicAgent.reset();
    setTopicAgentTopic(topic);
    setPendingTopicPatch(null);
    setTopicPatchOpen(false);
    setTopicAgentOpen(true);
  };

  const applyTopicPatchToForm = () => {
    if (!pendingTopicPatch) return;
    const base = topicAgentTopic;
    setEditingTopic(base);
    form.setFieldsValue({
      title: pendingTopicPatch.title ?? base?.title,
      source_type: pendingTopicPatch.sourceType
        ?? base?.source_type
        ?? (base?.source_post_id ? "blog" : "idea"),
      source_url: pendingTopicPatch.sourceUrl === undefined
        ? base?.source_url
        : pendingTopicPatch.sourceUrl,
      source_post_id: pendingTopicPatch.sourcePostId === undefined
        ? base?.source_post_id
        : pendingTopicPatch.sourcePostId,
      original_idea: pendingTopicPatch.originalIdea === undefined
        ? base?.original_idea
        : pendingTopicPatch.originalIdea,
      core_angle: pendingTopicPatch.coreAngle === undefined
        ? base?.core_angle
        : pendingTopicPatch.coreAngle,
      key_points: (pendingTopicPatch.keyPoints === undefined
        ? base?.key_points
        : pendingTopicPatch.keyPoints)?.join("\n"),
      status: pendingTopicPatch.status ?? base?.status ?? "IDEA",
    });
    setTopicPatchOpen(false);
    setPendingTopicPatch(null);
    setCreateOpen(true);
    message.success("AI 建议已应用到表单，请确认后保存");
  };

  const handleDelete = async (topicId: number) => {
    try {
      await requestApi(`/api/create/topics/${topicId}`, { method: "DELETE" });
      message.success("选题已删除");
      await loadTopics();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除选题失败");
    }
  };

  const openCreateDraft = (topic: TopicRecord) => {
    setDraftTopic(topic);
    draftForm.setFieldsValue({ platform: "xhs" });
    setDraftOpen(true);
  };

  const handleCreateDraft = async () => {
    if (!draftTopic) return;
    const values = await draftForm.validateFields();
    setSubmitting(true);
    try {
      const draft = await requestApi<DraftRecord>(`/api/create/topics/${draftTopic.id}/drafts`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      message.success("草稿已创建，已保存选题和平台模板快照");
      setDraftOpen(false);
      setDraftTopic(null);
      await loadTopics();
      router.push(`/create/drafts/${draft.id}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建草稿失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAiGenerate = async () => {
    const values = await aiForm.validateFields();
    setSubmitting(true);
    try {
      const result = await requestApi<{ created: TopicRecord[]; skipped: TopicRecord[] }>(
        "/api/create/topics/generate-from-post",
        {
          method: "POST",
          body: JSON.stringify(values),
        },
      );
      message.success(`已生成 ${result.created.length} 个选题，跳过 ${result.skipped.length} 个重复选题`);
      setAiOpen(false);
      aiForm.resetFields();
      await loadTopics();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "AI 选题失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <PageHeader
          eyebrow="topic bank"
          title="选题库"
          description="沉淀创作意图、来源和核心角度；同一个选题可分别进入多个平台草稿。"
          actions={(
            <>
              <Button type="primary" icon={<RobotOutlined />} onClick={() => openTopicAgent()}>
                AI 整理选题
              </Button>
              <Button icon={<RobotOutlined />} onClick={() => setAiOpen(true)}>
                AI 从博客选题
              </Button>
              <Button color="primary" variant="solid" icon={<PlusOutlined />} onClick={openCreate}>
                新建选题
              </Button>
            </>
          )}
        />
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          status={status}
          onStatusChange={setStatus}
          onRefresh={loadTopics}
          statusOptionsList={topicStatusOptions}
        />
        {loading ? (
          <LoadingList />
        ) : data?.record.length ? (
          <div className="grid gap-3">
            {data.record.map((topic) => (
              <article key={topic.id} className="rounded-md border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Tag color="blue">{topic.status}</Tag>
                      <Tag>{topicSourceLabel.get(topic.source_type || "") || "历史选题"}</Tag>
                      {topic.source_post_id ? <Tag color="green">博客 #{topic.source_post_id}</Tag> : null}
                    </div>
                    <h2 className="line-clamp-2 text-base font-semibold text-slate-950">{topic.title}</h2>
                    {topic.core_angle ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">核心角度：{topic.core_angle}</p>
                    ) : null}
                    {topic.original_idea || topic.description ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">原始想法：{topic.original_idea || topic.description}</p>
                    ) : null}
                    {topic.key_points?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{topic.key_points.slice(0, 4).map((point) => <Tag key={point}>{point}</Tag>)}</div> : null}
                  </div>
                  <div className="grid shrink-0 grid-cols-3 gap-2 text-center text-xs text-slate-500 lg:w-56">
                    <div className="rounded-md bg-slate-50 px-2 py-2">
                      <div className="text-base font-semibold text-slate-900">{topic._count?.drafts ?? 0}</div>
                      草稿
                    </div>
                    <div className="rounded-md bg-slate-50 px-2 py-2">
                      <div className="text-base font-semibold text-slate-900">{topic._count?.assets ?? 0}</div>
                      素材
                    </div>
                    <div className="rounded-md bg-slate-50 px-2 py-2">
                      <div className="text-base font-semibold text-slate-900">{formatDate(topic.updated_at)}</div>
                      更新
                    </div>
                    <div className="col-span-3 flex flex-wrap justify-end gap-1 pt-1">
                      <Button size="small" icon={<FileTextOutlined />} onClick={() => openCreateDraft(topic)}>创建草稿</Button>
                      <Button size="small" icon={<RobotOutlined />} onClick={() => openTopicAgent(topic)}>AI 完善</Button>
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(topic)}>编辑</Button>
                      <Popconfirm title="删除这个选题？已关联草稿会保留，但不再关联选题。" onConfirm={() => handleDelete(topic.id)}>
                        <Button size="small" color="danger" variant="text" icon={<DeleteOutlined />}>删除</Button>
                      </Popconfirm>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState text="暂无选题，可以记录一个想法，或让 AI 从博客文章整理。" />
        )}
      </div>

      <Modal
        title={editingTopic ? "编辑选题" : "新建选题"}
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateOpen(false); setEditingTopic(null); form.resetFields(); }}
        confirmLoading={submitting}
        forceRender
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="选题标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item name="source_type" label="来源类型" initialValue="idea">
              <Select options={topicSourceOptions} />
            </Form.Item>
            <Form.Item name="status" label="状态" initialValue="IDEA">
              <Select options={topicStatusOptions.filter((option) => option.value)} />
            </Form.Item>
          </div>
          <Form.Item name="original_idea" label="原始想法">
            <Input.TextArea rows={3} placeholder="为什么想做这个选题？保留你的原话。" />
          </Form.Item>
          <Form.Item name="core_angle" label="核心角度">
            <Input.TextArea rows={2} placeholder="准备从什么角度讲，给草稿 Agent 什么上下文。" />
          </Form.Item>
          <Form.Item name="key_points" label="关键点">
            <Input.TextArea rows={3} placeholder="每行一个，希望草稿覆盖的关键信息。" />
          </Form.Item>
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item name="source_url" label="来源链接">
              <Input placeholder="https://..." />
            </Form.Item>
            <Form.Item name="source_post_id" label="来源博客 ID">
              <BlogSourceSelector onSelect={() => form.setFieldValue("source_type", "blog")} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title={`从「${draftTopic?.title || "选题"}」创建草稿`}
        open={draftOpen}
        onOk={handleCreateDraft}
        onCancel={() => { setDraftOpen(false); setDraftTopic(null); draftForm.resetFields(); }}
        confirmLoading={submitting}
        okText="创建并进入草稿"
        forceRender
        destroyOnHidden
      >
        <Form form={draftForm} layout="vertical">
          <Form.Item name="platform" label="目标平台" rules={[{ required: true }]}>
            <Select options={topicDraftPlatformOptions} />
          </Form.Item>
          <p className="text-sm leading-6 text-slate-500">会保存当前选题和平台模板快照。进入草稿后可显式调用 AI 生成初稿，后续修改选题或模板不会改写历史上下文。</p>
        </Form>
      </Modal>

      <Modal
        title="AI 从博客选题"
        open={aiOpen}
        onOk={handleAiGenerate}
        onCancel={() => setAiOpen(false)}
        confirmLoading={submitting}
        okText="生成并入库"
        forceRender
        destroyOnHidden
      >
        <Form form={aiForm} layout="vertical" initialValues={{ limit: 5 }}>
          <Form.Item name="postId" label="博客文章 ID" rules={[{ required: true }]}>
            <InputNumber min={1} className="w-full" />
          </Form.Item>
          <Form.Item name="limit" label="生成数量">
            <InputNumber min={1} max={8} className="w-full" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="确认 AI 选题建议"
        open={topicPatchOpen}
        onCancel={() => setTopicPatchOpen(false)}
        onOk={applyTopicPatchToForm}
        okText="应用到表单"
        cancelText="暂不应用"
        width={880}
        destroyOnHidden
      >
        {topicPatchDiff ? (
          <ContentDiffViewer
            oldValue={topicPatchDiff.oldValue}
            newValue={topicPatchDiff.newValue}
            leftTitle="当前选题"
            rightTitle="AI 建议"
            className="max-h-[60vh] overflow-auto"
          />
        ) : null}
      </Modal>

      <TopicAgentPanel
        open={topicAgentOpen}
        onClose={() => setTopicAgentOpen(false)}
        messages={topicAgent.messages}
        isStreaming={topicAgent.isStreaming}
        onSend={(text) => topicAgent.sendMessage(text, topicAgent.messages)}
        onAbort={topicAgent.abort}
        hasPendingPatch={Boolean(pendingTopicPatch)}
        onViewPatch={() => setTopicPatchOpen(true)}
        editingTitle={topicAgentTopic?.title}
      />
    </div>
  );
}

export function CreateDraftsManager() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PageResult<DraftRecord> | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const createDraftPlatform = Form.useWatch("platform", form);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "30" });
      if (query.trim()) params.set("query", query.trim());
      if (status) params.set("status", status);
      if (type) params.set("type", type);
      setData(await requestApi<PageResult<DraftRecord>>(`/api/create/drafts?${params.toString()}`));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载草稿失败");
    } finally {
      setLoading(false);
    }
  }, [query, status, type]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  const handleCreate = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const draft = await requestApi<DraftRecord>("/api/create/drafts", {
        method: "POST",
        body: JSON.stringify(values),
      });
      message.success("草稿已创建");
      setCreateOpen(false);
      form.resetFields();
      router.push(`/create/drafts/${draft.id}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建草稿失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (draftId: number) => {
    try {
      await requestApi(`/api/create/drafts/${draftId}`, {
        method: "DELETE",
      });
      message.success("草稿已删除");
      await loadDrafts();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除草稿失败");
    }
  };

  const draftStats = useMemo(() => {
    const records = data?.record ?? [];
    return {
      total: data?.total ?? 0,
      ready: records.filter((item) => item.status === "READY").length,
      withImages: records.filter((item) => (item.selected_images?.length ?? 0) > 0).length,
    };
  }, [data]);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <PageHeader
          eyebrow="drafts first"
          title="草稿库"
          description="草稿列表只保留入口和状态流转，正文、图片和细节都进入草稿编辑页处理。"
          actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建草稿</Button>}
        />
        <section className="grid gap-3 md:grid-cols-3">
          <Metric label="草稿总数" value={draftStats.total} icon={<FileTextOutlined />} />
          <Metric label="就绪草稿" value={draftStats.ready} icon={<BulbOutlined />} />
          <Metric label="已选图片" value={draftStats.withImages} icon={<PictureOutlined />} />
        </section>
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          status={status}
          onStatusChange={setStatus}
          onRefresh={loadDrafts}
          statusOptionsList={draftStatusOptions}
          extra={(
            <Select
              value={type}
              options={draftTypeOptions}
              onChange={setType}
              className="w-full lg:w-40"
            />
          )}
        />
        {loading ? (
          <LoadingList />
        ) : data?.record.length ? (
          <div className="grid gap-3">
            {data.record.map((draft) => (
              <article key={draft.id} className="rounded-md border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Tag color="blue">{draftStatusLabel.get(draft.status) ?? draft.status}</Tag>
                      <Tag>{draftTypeLabel.get(draft.type) ?? draft.type}</Tag>
                      {(draft.selected_images?.length ?? 0) > 0 ? (
                        <Tag color="green">{draft.selected_images?.length} 张图片</Tag>
                      ) : null}
                    </div>
                    <h2 className="line-clamp-2 text-base font-semibold text-slate-950">{draft.title}</h2>
                    {draft.body ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{draft.body}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 lg:w-56">
                    <div className="rounded-md bg-slate-50 px-2 py-2">
                      <div className="text-sm font-semibold text-slate-900">{formatDate(draft.updated_at)}</div>
                      更新
                    </div>
                    <div className="flex gap-2">
                      <Button
                        icon={<EditOutlined />}
                        onClick={() => router.push(`/create/drafts/${draft.id}`)}
                        className="flex-1"
                      >
                        编辑
                      </Button>
                      <Popconfirm
                        title="删除草稿"
                        description="删除后无法恢复，确认继续？"
                        okText="删除"
                        cancelText="取消"
                        onConfirm={() => handleDelete(draft.id)}
                      >
                        <Button danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState text="暂无草稿，可以先新建一个草稿再进入编辑页补内容。" />
        )}
      </div>

      <Modal
        title="新建草稿"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ platform: "xhs", type: "note", status: "DRAFT" }}>
          <Form.Item name="title" label="草稿标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <div className="grid gap-3 md:grid-cols-3">
            <Form.Item name="platform" label="平台" rules={[{ required: true }]}>
              <Select
                options={draftPlatformCreateOptions}
                onChange={(platform) => form.setFieldValue("type", platform === "zhihu" ? "article" : "note")}
              />
            </Form.Item>
            <Form.Item name="type" label="类型" rules={[{ required: true }]}>
              <Select options={draftTypeCreateOptions} disabled={createDraftPlatform === "zhihu"} />
            </Form.Item>
            <Form.Item name="status" label="状态" rules={[{ required: true }]}>
              <Select options={draftStatusCreateOptions} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-4">
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
      </div>
      <div className="text-xl text-slate-400">{icon}</div>
    </div>
  );
}
