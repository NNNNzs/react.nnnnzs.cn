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
  EditOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import MarkdownPreview from "@/components/MarkdownPreview";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ContentDiffViewer } from "@/components/diff/ContentDiffViewer";
import type {
  AiTemplateCapabilityLoadMode,
  AiTemplateCapabilityRole,
} from "@/types/ai-template-capability";

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
  aliases: string[] | null;
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

interface NewTemplateForm extends CapabilityFormValues {
  slug: string;
  name: string;
  type: string;
  scope: string;
  description?: string;
  aliases?: string;
  content: string;
}

interface CapabilityReferenceForm {
  slug: string;
  role: AiTemplateCapabilityRole;
  load: AiTemplateCapabilityLoadMode;
  tasks?: string[];
}

interface CapabilityFormValues {
  scenarios?: string[];
  platforms?: string[];
  draftTypes?: string[];
  tasks?: string[];
  references?: CapabilityReferenceForm[];
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

const CAPABILITY_ROLE_OPTIONS: Array<{ label: string; value: AiTemplateCapabilityRole }> = [
  { label: "风格", value: "style" },
  { label: "任务", value: "task" },
  { label: "上下文", value: "context" },
  { label: "指令", value: "instruction" },
];

const CAPABILITY_LOAD_OPTIONS: Array<{ label: string; value: AiTemplateCapabilityLoadMode }> = [
  { label: "按需加载", value: "on_demand" },
  { label: "必须加载", value: "always" },
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length > 0 ? items : undefined;
}

function capabilityFormValues(metadata: unknown): CapabilityFormValues {
  const record = asRecord(metadata);
  const appliesTo = asRecord(record?.appliesTo);
  const references = Array.isArray(record?.references)
    ? record.references.flatMap((item) => {
      const reference = asRecord(item);
      if (!reference) return [];
      const slug = typeof reference?.slug === "string" ? reference.slug : "";
      const role = reference?.role;
      const load = reference?.load;
      if (!slug || !["style", "task", "context", "instruction"].includes(String(role))) return [];
      if (load !== "on_demand" && load !== "always") return [];
      return [{
        slug,
        role: role as AiTemplateCapabilityRole,
        load: load as AiTemplateCapabilityLoadMode,
        tasks: asStringArray(reference.tasks),
      }];
    })
    : undefined;

  return {
    scenarios: asStringArray(appliesTo?.scenarios),
    platforms: asStringArray(appliesTo?.platforms),
    draftTypes: asStringArray(appliesTo?.draftTypes),
    tasks: asStringArray(appliesTo?.tasks),
    references,
  };
}

function buildCapabilityMetadata(base: unknown, values: CapabilityFormValues) {
  const baseRecord = asRecord(base) || {};
  const otherMetadata = Object.fromEntries(
    Object.entries(baseRecord).filter(([key]) => !["appliesTo", "references", "schemaVersion"].includes(key)),
  );
  const appliesTo = Object.fromEntries(
    Object.entries({
      scenarios: values.scenarios,
      platforms: values.platforms,
      draftTypes: values.draftTypes,
      tasks: values.tasks,
    }).filter(([, value]) => value && value.length > 0),
  );
  const references = (values.references || []).map((reference) => ({
    slug: reference.slug.trim(),
    role: reference.role,
    load: reference.load,
    ...(reference.tasks?.length ? { tasks: reference.tasks } : {}),
  }));

  return {
    ...otherMetadata,
    schemaVersion: 1,
    ...(Object.keys(appliesTo).length > 0 ? { appliesTo } : {}),
    ...(references.length > 0 ? { references } : {}),
  };
}

type SortField = "name" | "updated_at" | "created_at" | "current_version";
type SortOrder = "asc" | "desc";

const SORT_OPTIONS: Array<{ label: string; field: SortField; order: SortOrder }> = [
  { label: "名称", field: "name", order: "asc" },
  { label: "更新时间", field: "updated_at", order: "desc" },
  { label: "创建时间", field: "created_at", order: "desc" },
  { label: "版本号", field: "current_version", order: "desc" },
];

export default function AiLabPromptsPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [mentionTemplates, setMentionTemplates] = useState<TemplateSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [editorValue, setEditorValue] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSlug, setEditSlug] = useState<string>("");
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [fromVersion, setFromVersion] = useState<number | null>(null);
  const [toVersion, setToVersion] = useState<number | null>(null);
  const [activeVersionMetadata, setActiveVersionMetadata] = useState<unknown>(null);
  const [newForm] = Form.useForm<NewTemplateForm>();
  const [editForm] = Form.useForm<NewTemplateForm>();
  const [capabilityForm] = Form.useForm<CapabilityFormValues>();

  const mentionOptions: MentionsOptionProps[] = useMemo(
    () => mentionTemplates.map((item) => ({
      value: item.slug,
      label: (
        <span className="inline-flex items-center gap-2">
          <span>{item.name}</span>
          <Tag className="mr-0" color="cyan">{item.type}</Tag>
        </span>
      ),
    })),
    [mentionTemplates],
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

  const sortedTemplates = useMemo(() => {
    const sorted = [...templates].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name, "zh-CN");
      } else if (sortField === "current_version") {
        cmp = a.current_version - b.current_version;
      } else {
        cmp = new Date(a[sortField]).getTime() - new Date(b[sortField]).getTime();
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [templates, sortField, sortOrder]);

  const handleSortChange = useCallback((value: string) => {
    const option = SORT_OPTIONS.find((o) => o.field === value);
    if (!option) return;
    if (option.field === sortField) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(option.field);
      setSortOrder(option.order);
    }
  }, [sortField]);

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
      setSelectedSlug((current) => current || result.data.record?.[0]?.slug || "");
    } finally {
      setLoading(false);
    }
  }, [query, type]);

  const loadMentionTemplates = useCallback(async () => {
    const pageSize = 100;
    const records: TemplateSummary[] = [];
    let pageNum = 1;
    let total = 0;

    do {
      const params = new URLSearchParams({
        pageNum: String(pageNum),
        pageSize: String(pageSize),
        status: "ACTIVE",
      });

      const response = await fetch(`/api/admin/ai-lab/prompts?${params}`, {
        cache: "no-store",
      });
      const result = await response.json() as ApiResponse<TemplateListData>;
      if (!result.status) {
        message.error(result.message || "加载提及模板失败");
        return;
      }

      const pageRecords = result.data.record || [];
      records.push(...pageRecords);
      total = result.data.total || records.length;
      if (pageRecords.length === 0) break;
      pageNum += 1;
    } while (records.length < total);

    setMentionTemplates(records);
  }, []);

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
      setActiveVersionMetadata(active?.metadata_json ?? null);
      capabilityForm.resetFields();
      capabilityForm.setFieldsValue(capabilityFormValues(active?.metadata_json));
      setChangeNote("");
      setFromVersion(sortedVersions[1]?.version ?? null);
      setToVersion(active?.version ?? null);
    } finally {
      setDetailLoading(false);
    }
  }, [capabilityForm]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    void loadMentionTemplates();
  }, [loadMentionTemplates]);

  useEffect(() => {
    if (selectedSlug) {
      void loadDetail(selectedSlug);
    }
  }, [loadDetail, selectedSlug]);

  const handleCreateTemplate = useCallback(async () => {
    const values = await newForm.validateFields();
    const {
      scenarios,
      platforms,
      draftTypes,
      tasks,
      references,
      ...templateValues
    } = values;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/ai-lab/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...templateValues,
          aliases: parseAliases(templateValues.aliases),
          metadata: buildCapabilityMetadata(null, {
            scenarios,
            platforms,
            draftTypes,
            tasks,
            references,
          }),
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
      await Promise.all([loadTemplates(), loadMentionTemplates()]);
      if (templateValues.slug) setSelectedSlug(templateValues.slug);
    } finally {
      setSaving(false);
    }
  }, [loadMentionTemplates, loadTemplates, newForm]);

  const handleOpenEdit = useCallback((slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = templates.find((t) => t.slug === slug);
    if (!item) return;
    setEditSlug(slug);
    editForm.setFieldsValue({
      slug,
      name: item.name,
      type: item.type,
      scope: item.scope,
      description: item.description || "",
      aliases: (item.aliases || []).join(", "),
    });
    setEditOpen(true);
  }, [editForm, templates]);

  const handleUpdateTemplate = useCallback(async () => {
    const values = await editForm.validateFields();
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/ai-lab/prompts/${encodeURIComponent(editSlug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          type: values.type,
          scope: values.scope,
          description: values.description || null,
          aliases: parseAliases(values.aliases),
        }),
      });
      const result = await response.json() as ApiResponse<TemplateDetail>;
      if (!result.status) {
        message.error(result.message || "更新失败");
        return;
      }
      message.success("模板已更新");
      setEditOpen(false);
      editForm.resetFields();
      await Promise.all([loadTemplates(), loadMentionTemplates()]);
      if (selectedSlug === editSlug) {
        await loadDetail(editSlug);
      }
    } finally {
      setSaving(false);
    }
  }, [editForm, editSlug, loadDetail, loadMentionTemplates, loadTemplates, selectedSlug]);

  const handleSaveVersion = useCallback(async () => {
    if (!detail) return;
    const capabilityValues = await capabilityForm.validateFields();
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/ai-lab/prompts/${encodeURIComponent(detail.slug)}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editorValue,
          metadata: buildCapabilityMetadata(activeVersionMetadata, capabilityValues),
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
      await Promise.all([loadTemplates(), loadMentionTemplates()]);
    } finally {
      setSaving(false);
    }
  }, [activeVersionMetadata, capabilityForm, changeNote, detail, editorValue, loadDetail, loadMentionTemplates, loadTemplates]);

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
      await Promise.all([loadTemplates(), loadMentionTemplates()]);
    } finally {
      setSaving(false);
    }
  }, [detail, loadDetail, loadMentionTemplates, loadTemplates]);

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
      .map((slug) => mentionTemplates.find((item) => item.slug === slug))
      .filter((item): item is TemplateSummary => Boolean(item)),
    [currentMentionSlugs, mentionTemplates],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AdminPageHeader
        title="Prompts"
        className="mb-2"
        extra={(
          <Space wrap>
            <Button size="small" color="primary" variant="solid" icon={<PlusOutlined />} onClick={() => setNewOpen(true)}>
              新建
            </Button>
            <Button size="small" icon={<ReloadOutlined />} onClick={() => void Promise.all([loadTemplates(), loadMentionTemplates()])}>
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
        <Select
          size="small"
          className="w-36"
          value={sortField}
          options={SORT_OPTIONS.map((o) => ({
            value: o.field,
            label: (
              <span className="inline-flex items-center gap-1">
                {o.label}
                {o.field === sortField && (
                  <span className="text-xs text-slate-400">{sortOrder === "asc" ? "↑" : "↓"}</span>
                )}
              </span>
            ),
          }))}
          onChange={handleSortChange}
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
              {sortedTemplates.map((item) => (
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
                    <div className="flex shrink-0 items-center gap-1">
                      <EditOutlined
                        className="cursor-pointer p-0.5 text-xs text-slate-400 hover:text-cyan-600"
                        onClick={(e) => handleOpenEdit(item.slug, e)}
                      />
                      <Tag className="mr-0" color={STATUS_COLOR.get(item.status)}>{item.status}</Tag>
                    </div>
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
              <Spin tip="加载模板详情...">
                <div />
              </Spin>
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
                  {(detail.aliases ?? []).length > 0
                    ? detail.aliases!.map((alias) => <Tag key={alias}>{alias}</Tag>)
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

              <div className="border-t border-slate-100 pt-4">
                <Typography.Text strong>版本能力配置</Typography.Text>
                <Typography.Paragraph type="secondary" className="!mt-1 !mb-3 !text-xs">
                  所有 Agent 共用：按运行场景和内容条件筛选后，按需加载下方引用的 Prompt / Skill。
                </Typography.Paragraph>
                <Form form={capabilityForm} layout="vertical" size="small">
                  <Form.Item name="scenarios" label="适用场景">
                    <Select
                      mode="tags"
                      tokenSeparators={[",", "，", " "]}
                      placeholder="chat / topic_agent / create_agent"
                    />
                  </Form.Item>
                  <Form.Item name="platforms" label="适用平台">
                    <Select mode="tags" tokenSeparators={[",", "，", " "]} placeholder="xhs / zhihu" />
                  </Form.Item>
                  <Form.Item name="draftTypes" label="适用内容类型">
                    <Select mode="tags" tokenSeparators={[",", "，", " "]} placeholder="note / article" />
                  </Form.Item>
                  <Form.Item name="tasks" label="适用任务">
                    <Select mode="tags" tokenSeparators={[",", "，", " "]} placeholder="image_generation" />
                  </Form.Item>
                  <Form.List name="references">
                    {(fields, { add, remove }) => (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Typography.Text strong>引用模板</Typography.Text>
                          <Button
                            size="small"
                            type="dashed"
                            icon={<PlusOutlined />}
                            onClick={() => add({ role: "style", load: "on_demand" })}
                          >
                            添加
                          </Button>
                        </div>
                        {fields.map((field) => (
                          <div key={field.key} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                            <div className="flex items-start gap-1.5">
                              <div className="min-w-0 flex-1 space-y-2">
                                <Form.Item name={[field.name, "slug"]} rules={[{ required: true, message: "请选择模板" }]} className="!mb-0">
                                  <Select
                                    showSearch
                                    optionFilterProp="label"
                                    placeholder="选择 Prompt / Skill"
                                    options={mentionTemplates.map((item) => ({
                                      value: item.slug,
                                      label: `${item.name} (@${item.slug})`,
                                    }))}
                                  />
                                </Form.Item>
                                <div className="grid grid-cols-2 gap-2">
                                  <Form.Item name={[field.name, "role"]} rules={[{ required: true }]} className="!mb-0">
                                    <Select options={CAPABILITY_ROLE_OPTIONS} />
                                  </Form.Item>
                                  <Form.Item name={[field.name, "load"]} rules={[{ required: true }]} className="!mb-0">
                                    <Select options={CAPABILITY_LOAD_OPTIONS} />
                                  </Form.Item>
                                </div>
                                <Form.Item name={[field.name, "tasks"]} className="!mb-0">
                                  <Select mode="tags" tokenSeparators={[",", "，", " "]} placeholder="限定任务（可选）" />
                                </Form.Item>
                              </div>
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<MinusCircleOutlined />}
                                onClick={() => remove(field.name)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Form.List>
                </Form>
              </div>

              <div>
                <Typography.Text strong>当前启用版本 Metadata</Typography.Text>
                <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                  {asJsonText(activeVersionMetadata)}
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
          <div className="mb-4 rounded-md border border-cyan-100 bg-cyan-50/50 p-3">
            <Typography.Text strong>版本能力配置（可选）</Typography.Text>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <Form.Item name="scenarios" label="适用场景" className="!mb-0">
                <Select mode="tags" tokenSeparators={[",", "，", " "]} placeholder="create_agent" />
              </Form.Item>
              <Form.Item name="platforms" label="适用平台" className="!mb-0">
                <Select mode="tags" tokenSeparators={[",", "，", " "]} placeholder="xhs / zhihu" />
              </Form.Item>
              <Form.Item name="draftTypes" label="适用内容类型" className="!mb-0">
                <Select mode="tags" tokenSeparators={[",", "，", " "]} placeholder="note / article" />
              </Form.Item>
              <Form.Item name="tasks" label="适用任务" className="!mb-0">
                <Select mode="tags" tokenSeparators={[",", "，", " "]} placeholder="image_generation" />
              </Form.Item>
            </div>
            <Form.List name="references">
              {(fields, { add, remove }) => (
                <div className="mt-3 space-y-2">
                  <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => add({ role: "style", load: "on_demand" })}>
                    添加引用模板
                  </Button>
                  {fields.map((field) => (
                    <div key={field.key} className="flex items-center gap-2">
                      <Form.Item name={[field.name, "slug"]} rules={[{ required: true, message: "请选择模板" }]} className="!mb-0 flex-1">
                        <Select
                          showSearch
                          optionFilterProp="label"
                          placeholder="选择 Prompt / Skill"
                          options={mentionTemplates.map((item) => ({ value: item.slug, label: `${item.name} (@${item.slug})` }))}
                        />
                      </Form.Item>
                      <Form.Item name={[field.name, "role"]} className="!mb-0 w-24">
                        <Select options={CAPABILITY_ROLE_OPTIONS} />
                      </Form.Item>
                      <Form.Item name={[field.name, "load"]} className="!mb-0 w-28">
                        <Select options={CAPABILITY_LOAD_OPTIONS} />
                      </Form.Item>
                      <Button type="text" danger size="small" icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </div>
                  ))}
                </div>
              )}
            </Form.List>
          </div>
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

      <Modal
        title="编辑模板信息"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleUpdateTemplate}
        confirmLoading={saving}
        width={820}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Form.Item name="slug" label="Slug">
              <Input disabled placeholder="xhs-style-guide" />
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
        </Form>
      </Modal>

      <Drawer
        title={diffData ? `${diffData.name} v${diffData.fromVersion} → v${diffData.toVersion}` : "版本对比"}
        open={diffOpen}
        onClose={() => setDiffOpen(false)}
        size="large"
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
