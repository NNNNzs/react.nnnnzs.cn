"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Mentions,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import type { MentionsOptionProps } from "antd/es/mentions";
import {
  BranchesOutlined,
  DiffOutlined,
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import MarkdownPreview from "@/components/MarkdownPreview";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ContentDiffViewer } from "@/components/diff/ContentDiffViewer";

interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface TemplateSummary {
  id: number;
  slug: string;
  key: string | null;
  name: string;
  type: string;
  scope: string;
  description: string | null;
  aliases: string[];
  metadata_json: unknown;
  current_version: number;
  status: string;
  created_at: string;
  updated_at: string;
  latestVersion?: {
    id: number;
    version: number;
    checksum: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  } | null;
}

interface TemplateVersion {
  id: number;
  template_id: number;
  version: number;
  content: string;
  checksum: string | null;
  metadata_json: unknown;
  change_note: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TemplateDetail extends Omit<TemplateSummary, "latestVersion"> {
  versions: TemplateVersion[];
}

interface TemplateListData {
  record: TemplateSummary[];
  total: number;
  pageNum: number;
  pageSize: number;
}

interface DiffData {
  slug: string;
  name: string;
  fromVersion: number;
  toVersion: number;
  oldContent: string;
  newContent: string;
  currentVersion: number;
}

interface NewTemplateForm {
  slug: string;
  name: string;
  type: string;
  scope: string;
  description?: string;
  aliases?: string;
  content: string;
}

const TYPE_OPTIONS = [
  { label: "Prompt", value: "prompt" },
  { label: "Skill", value: "skill" },
  { label: "Style", value: "style" },
  { label: "Context", value: "context" },
  { label: "Tool Instruction", value: "tool_instruction" },
  { label: "Schema", value: "schema" },
  { label: "Checklist", value: "checklist" },
];

const STATUS_COLOR = new Map([
  ["ACTIVE", "green"],
  ["DRAFT", "gold"],
  ["ARCHIVED", "default"],
]);

function asJsonText(value: unknown) {
  if (!value) return "{}";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function parseAliases(value?: string) {
  return (value || "")
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AiLabPromptsPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [editorValue, setEditorValue] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [fromVersion, setFromVersion] = useState<number | null>(null);
  const [toVersion, setToVersion] = useState<number | null>(null);
  const [newForm] = Form.useForm<NewTemplateForm>();

  const mentionOptions: MentionsOptionProps[] = useMemo(
    () => templates.map((item) => ({
      value: item.slug,
      label: (
        <span className="inline-flex items-center gap-2">
          <span>{item.name}</span>
          <Tag className="mr-0" color="cyan">{item.type}</Tag>
        </span>
      ),
    })),
    [templates],
  );

  const versionOptions = useMemo(
    () => (detail?.versions || [])
      .slice()
      .sort((a, b) => b.version - a.version)
      .map((item) => ({
        value: item.version,
        label: `v${item.version} · ${dayjs(item.created_at).format("MM-DD HH:mm")}`,
      })),
    [detail],
  );

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        pageSize: "100",
        status: "ACTIVE",
      });
      if (query.trim()) params.set("query", query.trim());
      if (type) params.set("type", type);

      const response = await fetch(`/api/admin/ai-lab/prompts?${params}`, {
        cache: "no-store",
      });
      const result = await response.json() as ApiResponse<TemplateListData>;
      if (!result.status) {
        message.error(result.message || "加载模板失败");
        return;
      }
      setTemplates(result.data.record || []);
      if (!selectedSlug && result.data.record?.[0]) {
        setSelectedSlug(result.data.record[0].slug);
      }
    } finally {
      setLoading(false);
    }
  }, [query, selectedSlug, type]);

  const loadDetail = useCallback(async (slug: string) => {
    if (!slug) return;
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/ai-lab/prompts/${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      const result = await response.json() as ApiResponse<TemplateDetail>;
      if (!result.status) {
        message.error(result.message || "加载模板详情失败");
        return;
      }
      const sortedVersions = [...(result.data.versions || [])].sort((a, b) => b.version - a.version);
      const active = sortedVersions.find((item) => item.version === result.data.current_version) || sortedVersions[0];
      setDetail({ ...result.data, versions: sortedVersions });
      setEditorValue(active?.content || "");
      setChangeNote("");
      setFromVersion(sortedVersions[1]?.version ?? null);
      setToVersion(active?.version ?? null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (selectedSlug) {
      void loadDetail(selectedSlug);
    }
  }, [loadDetail, selectedSlug]);

  const handleImportLegacy = useCallback(async () => {
    setImporting(true);
    try {
      const response = await fetch("/api/admin/ai-lab/prompts/import-legacy", {
        method: "POST",
      });
      const result = await response.json() as ApiResponse<{
        created: unknown[];
        updated: unknown[];
        skipped: unknown[];
      }>;
      if (!result.status) {
        message.error(result.message || "导入失败");
        return;
      }
      message.success(`导入完成：新增 ${result.data.created.length}，更新 ${result.data.updated.length}，跳过 ${result.data.skipped.length}`);
      await loadTemplates();
    } finally {
      setImporting(false);
    }
  }, [loadTemplates]);

  const handleCreateTemplate = useCallback(async () => {
    const values = await newForm.validateFields();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/ai-lab/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          aliases: parseAliases(values.aliases),
        }),
      });
      const result = await response.json() as ApiResponse<TemplateDetail | null>;
      if (!result.status) {
        message.error(result.message || "创建失败");
        return;
      }
      message.success("模板已创建");
      setNewOpen(false);
      newForm.resetFields();
      await loadTemplates();
      if (values.slug) setSelectedSlug(values.slug);
    } finally {
      setSaving(false);
    }
  }, [loadTemplates, newForm]);

  const handleSaveVersion = useCallback(async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/ai-lab/prompts/${encodeURIComponent(detail.slug)}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editorValue,
          changeNote: changeNote.trim() || undefined,
          activate: true,
        }),
      });
      const result = await response.json() as ApiResponse<TemplateVersion>;
      if (!result.status) {
        message.error(result.message || "保存版本失败");
        return;
      }
      message.success(`已保存 v${result.data.version}`);
      await loadDetail(detail.slug);
      await loadTemplates();
    } finally {
      setSaving(false);
    }
  }, [changeNote, detail, editorValue, loadDetail, loadTemplates]);

  const handleActivateVersion = useCallback(async (version: number) => {
    if (!detail) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/ai-lab/prompts/${encodeURIComponent(detail.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentVersion: version }),
      });
      const result = await response.json() as ApiResponse<TemplateDetail>;
      if (!result.status) {
        message.error(result.message || "启用版本失败");
        return;
      }
      message.success(`已启用 v${version}`);
      await loadDetail(detail.slug);
      await loadTemplates();
    } finally {
      setSaving(false);
    }
  }, [detail, loadDetail, loadTemplates]);

  const handleLoadDiff = useCallback(async () => {
    if (!detail || !fromVersion || !toVersion) {
      message.warning("请选择两个版本");
      return;
    }
    setDiffLoading(true);
    try {
      const params = new URLSearchParams({
        from: String(fromVersion),
        to: String(toVersion),
      });
      const response = await fetch(`/api/admin/ai-lab/prompts/${encodeURIComponent(detail.slug)}/diff?${params}`, {
        cache: "no-store",
      });
      const result = await response.json() as ApiResponse<DiffData>;
      if (!result.status) {
        message.error(result.message || "加载 diff 失败");
        return;
      }
      setDiffData(result.data);
      setDiffOpen(true);
    } finally {
      setDiffLoading(false);
    }
  }, [detail, fromVersion, toVersion]);

  const currentMentionSlugs = useMemo(() => {
    const matches = Array.from(editorValue.matchAll(/(^|[\s([{，。；：、])@([A-Za-z0-9_.-]+)/g));
    return Array.from(new Set(matches.map((match) => match[2])));
  }, [editorValue]);

  const mentionedTemplates = useMemo(
    () => currentMentionSlugs
      .map((slug) => templates.find((item) => item.slug === slug))
      .filter((item): item is TemplateSummary => Boolean(item)),
    [currentMentionSlugs, templates],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AdminPageHeader
        title="Prompts"
        className="mb-2"
        extra={(
          <Space wrap>
            <Button size="small" icon={<DownloadOutlined />} onClick={handleImportLegacy} loading={importing}>
              导入旧模板
            </Button>
            <Button size="small" color="primary" variant="solid" icon={<PlusOutlined />} onClick={() => setNewOpen(true)}>
              新建
            </Button>
            <Button size="small" icon={<ReloadOutlined />} onClick={() => void loadTemplates()}>
              刷新
            </Button>
          </Space>
        )}
      />

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <Input.Search
          allowClear
          size="small"
          className="w-full max-w-xs"
          placeholder="搜索名称、slug、描述"
          onSearch={setQuery}
        />
        <Select
          allowClear
          size="small"
          className="w-48"
          placeholder="类型"
          options={TYPE_OPTIONS}
          value={type || undefined}
          onChange={(value) => setType(value || "")}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="min-h-0 overflow-y-auto rounded-md border border-slate-200 bg-white">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Spin />
            </div>
          ) : templates.length === 0 ? (
            <Empty className="py-12" description="暂无模板" />
          ) : (
            <div className="divide-y divide-slate-100">
              {templates.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => setSelectedSlug(item.slug)}
                  className={[
                    "block w-full px-3 py-3 text-left transition-colors",
                    selectedSlug === item.slug ? "bg-cyan-50" : "bg-white hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-950">{item.name}</span>
                    <Tag className="mr-0" color={STATUS_COLOR.get(item.status)}>{item.status}</Tag>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span className="truncate">@{item.slug}</span>
                    <span>v{item.current_version}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="min-h-0 overflow-hidden rounded-md border border-slate-200 bg-white">
          {detailLoading ? (
            <div className="flex h-full min-h-80 items-center justify-center">
              <Spin tip="加载模板详情..." />
            </div>
          ) : !detail ? (
            <Empty className="py-20" description="请选择一个模板" />
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="shrink-0 border-b border-slate-100 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <h2 className="m-0 truncate text-base font-semibold text-slate-950">{detail.name}</h2>
                      <Tag color="cyan">{detail.type}</Tag>
                      <Tag color="blue">v{detail.current_version}</Tag>
                    </div>
                    <p className="mt-1 mb-0 truncate text-xs text-slate-500">@{detail.slug}</p>
                  </div>
                  <Space wrap>
                    <Select
                      size="small"
                      className="w-40"
                      value={toVersion ?? undefined}
                      options={versionOptions}
                      onChange={setToVersion}
                    />
                    <Button size="small" icon={<BranchesOutlined />} disabled={!toVersion || toVersion === detail.current_version} loading={saving} onClick={() => toVersion && void handleActivateVersion(toVersion)}>
                      启用
                    </Button>
                    <Button size="small" icon={<DiffOutlined />} loading={diffLoading} onClick={handleLoadDiff}>
                      对比
                    </Button>
                    <Button size="small" color="primary" variant="solid" icon={<SaveOutlined />} loading={saving} onClick={handleSaveVersion}>
                      保存版本
                    </Button>
                  </Space>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
                <div className="min-h-0 border-b border-slate-100 lg:border-r lg:border-b-0">
                  <Mentions
                    className="h-full prompt-template-mentions"
                    autoSize={false}
                    rows={24}
                    prefix="@"
                    options={mentionOptions}
                    value={editorValue}
                    onChange={setEditorValue}
                    placeholder="使用 Markdown 编写 Prompt。变量使用 {{draftTitle}}，输入 @ 选择 Prompt Skill。"
                  />
                </div>
                <div className="min-h-0 overflow-y-auto bg-slate-50 px-4 py-3">
                  <MarkdownPreview content={editorValue || " "} />
                </div>
              </div>
              <div className="shrink-0 border-t border-slate-100 p-3">
                <Input
                  value={changeNote}
                  onChange={(event) => setChangeNote(event.target.value)}
                  placeholder="版本说明，例如：加入 @xhs-style-guide metadata 引用"
                />
              </div>
            </div>
          )}
        </main>

        <aside className="min-h-0 overflow-y-auto rounded-md border border-slate-200 bg-white p-4">
          {!detail ? (
            <Empty description="暂无 metadata" />
          ) : (
            <div className="flex w-full flex-col gap-4">
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="Slug">@{detail.slug}</Descriptions.Item>
                <Descriptions.Item label="Key">{detail.key || "-"}</Descriptions.Item>
                <Descriptions.Item label="Scope">{detail.scope}</Descriptions.Item>
                <Descriptions.Item label="当前版本">v{detail.current_version}</Descriptions.Item>
                <Descriptions.Item label="更新时间">{dayjs(detail.updated_at).format("YYYY-MM-DD HH:mm")}</Descriptions.Item>
              </Descriptions>

              <div>
                <Typography.Text strong>别名</Typography.Text>
                <div className="mt-2 flex flex-wrap gap-1">
                  {detail.aliases.length > 0
                    ? detail.aliases.map((alias) => <Tag key={alias}>{alias}</Tag>)
                    : <Typography.Text type="secondary">暂无</Typography.Text>}
                </div>
              </div>

              <div>
                <Typography.Text strong>@ 引用 metadata</Typography.Text>
                <div className="mt-2 space-y-2">
                  {mentionedTemplates.length === 0 ? (
                    <Typography.Text type="secondary">当前正文未引用已知模板</Typography.Text>
                  ) : mentionedTemplates.map((item) => (
                    <div key={item.slug} className="rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2">
                      <div className="text-sm font-medium text-cyan-950">{item.name}</div>
                      <div className="mt-1 text-xs text-cyan-800">@{item.slug} · v{item.current_version}</div>
                      {item.description ? (
                        <p className="mt-2 mb-0 text-xs leading-5 text-cyan-900">{item.description}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Typography.Text strong>Metadata JSON</Typography.Text>
                <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                  {asJsonText(detail.metadata_json)}
                </pre>
              </div>
            </div>
          )}
        </aside>
      </div>

      <Modal
        title="新建 Prompt / Skill 模板"
        open={newOpen}
        onCancel={() => setNewOpen(false)}
        onOk={handleCreateTemplate}
        confirmLoading={saving}
        width={820}
        destroyOnHidden
      >
        <Form
          form={newForm}
          layout="vertical"
          initialValues={{ type: "prompt", scope: "system" }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Form.Item name="slug" label="Slug" rules={[{ required: true }]}>
              <Input placeholder="xhs-style-guide" />
            </Form.Item>
            <Form.Item name="name" label="名称" rules={[{ required: true }]}>
              <Input placeholder="小红书风格指南" />
            </Form.Item>
            <Form.Item name="type" label="类型" rules={[{ required: true }]}>
              <Select options={TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item name="scope" label="Scope" rules={[{ required: true }]}>
              <Input placeholder="system / content / create_agent" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="aliases" label="别名（逗号或换行分隔）">
            <Input.TextArea rows={2} placeholder="小红书风格指南, 小红书写作风格" />
          </Form.Item>
          <Form.Item name="content" label="模板正文" rules={[{ required: true }]}>
            <Mentions
              prefix="@"
              rows={10}
              options={mentionOptions}
              placeholder="Markdown + LangChain mustache，例如 {{topic}}"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={diffData ? `${diffData.name} v${diffData.fromVersion} → v${diffData.toVersion}` : "版本对比"}
        open={diffOpen}
        onClose={() => setDiffOpen(false)}
        width="88vw"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Select
            className="w-48"
            value={fromVersion ?? undefined}
            options={versionOptions.filter((option) => option.value !== toVersion)}
            onChange={setFromVersion}
            placeholder="旧版本"
          />
          <Select
            className="w-48"
            value={toVersion ?? undefined}
            options={versionOptions.filter((option) => option.value !== fromVersion)}
            onChange={setToVersion}
            placeholder="新版本"
          />
          <Button icon={<DiffOutlined />} loading={diffLoading} onClick={handleLoadDiff}>重新对比</Button>
        </div>
        {diffData ? (
          <ContentDiffViewer
            oldValue={diffData.oldContent}
            newValue={diffData.newContent}
            leftTitle={`v${diffData.fromVersion}`}
            rightTitle={`v${diffData.toVersion}${diffData.toVersion === diffData.currentVersion ? "（当前）" : ""}`}
          />
        ) : (
          <Empty description="请选择版本进行对比" />
        )}
      </Drawer>
    </div>
  );
}
