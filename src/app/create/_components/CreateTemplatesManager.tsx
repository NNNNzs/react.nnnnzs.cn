"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Empty,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Skeleton,
  Tag,
  Tooltip,
  message,
} from "antd";
import {
  CloudDownloadOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
} from "@ant-design/icons";

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

interface ContentTemplateRecord {
  id: number;
  name: string;
  type: string;
  scenario: string;
  content: string;
  variables_json?: unknown;
  output_schema_json?: unknown;
  version: number;
  status: string;
  source_path?: string | null;
  created_at: string;
  updated_at: string;
}

interface TemplateEditorState {
  id: number | null;
  name: string;
  type: string;
  scenario: string;
  status: string;
  version: number;
  sourcePath: string;
  content: string;
  variablesText: string;
  outputSchemaText: string;
}

interface ImportTemplatesResult {
  created: ContentTemplateRecord[];
  updated: ContentTemplateRecord[];
}

const TEMPLATE_TYPE_OPTIONS = [
  { label: "Prompt", value: "prompt" },
  { label: "语音风格", value: "voice_style" },
  { label: "视觉模板", value: "visual" },
  { label: "Checklist", value: "checklist" },
  { label: "上下文", value: "context" },
];

const TEMPLATE_SCENARIO_OPTIONS = [
  { label: "博客转图文", value: "blog_to_xhs_note" },
  { label: "博客转短视频", value: "blog_to_short_video" },
  { label: "TTS", value: "tts" },
  { label: "图卡", value: "image_card" },
  { label: "内容 Agent", value: "content_agent" },
];

const TEMPLATE_STATUS_OPTIONS = [
  { label: "启用", value: "ACTIVE" },
  { label: "草稿", value: "DRAFT" },
  { label: "归档", value: "ARCHIVED" },
];

const ALL_OPTION = { label: "全部", value: "" };
const typeLabel = new Map(TEMPLATE_TYPE_OPTIONS.map((option) => [option.value, option.label]));
const scenarioLabel = new Map(TEMPLATE_SCENARIO_OPTIONS.map((option) => [option.value, option.label]));
const statusLabel = new Map(TEMPLATE_STATUS_OPTIONS.map((option) => [option.value, option.label]));

const EMPTY_EDITOR: TemplateEditorState = {
  id: null,
  name: "",
  type: "prompt",
  scenario: "blog_to_xhs_note",
  status: "ACTIVE",
  version: 1,
  sourcePath: "",
  content: "",
  variablesText: "",
  outputSchemaText: "",
};

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

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function parseJsonText(value: string, fieldName: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(`${fieldName} 不是合法 JSON`);
  }
}

function editorFromTemplate(template: ContentTemplateRecord): TemplateEditorState {
  return {
    id: template.id,
    name: template.name,
    type: template.type,
    scenario: template.scenario,
    status: template.status,
    version: template.version,
    sourcePath: template.source_path ?? "",
    content: template.content,
    variablesText: formatJson(template.variables_json),
    outputSchemaText: formatJson(template.output_schema_json),
  };
}

function getTemplateStatusColor(status: string) {
  if (status === "ACTIVE") return "green";
  if (status === "DRAFT") return "gold";
  if (status === "ARCHIVED") return "default";
  return "blue";
}

export function CreateTemplatesManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [data, setData] = useState<PageResult<ContentTemplateRecord> | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [scenarioFilter, setScenarioFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editor, setEditor] = useState<TemplateEditorState>(EMPTY_EDITOR);
  const [isCreating, setIsCreating] = useState(false);

  const templates = useMemo(() => data?.record ?? [], [data?.record]);
  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === editor.id) ?? null,
    [editor.id, templates],
  );

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const searchParams = new URLSearchParams({ pageSize: "100" });
      if (query.trim()) searchParams.set("query", query.trim());
      if (typeFilter) searchParams.set("type", typeFilter);
      if (scenarioFilter) searchParams.set("scenario", scenarioFilter);
      if (statusFilter) searchParams.set("status", statusFilter);

      const result = await requestApi<PageResult<ContentTemplateRecord>>(`/api/create/templates?${searchParams.toString()}`);
      setData(result);

      if (!isCreating) {
        const nextTemplate = result.record.find((template) => template.id === editor.id) ?? result.record[0] ?? null;
        setEditor(nextTemplate ? editorFromTemplate(nextTemplate) : EMPTY_EDITOR);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载模板失败");
    } finally {
      setLoading(false);
    }
  }, [editor.id, isCreating, query, scenarioFilter, statusFilter, typeFilter]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleSelectTemplate = (template: ContentTemplateRecord) => {
    setIsCreating(false);
    setEditor(editorFromTemplate(template));
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditor(EMPTY_EDITOR);
  };

  const handleEditorChange = <K extends keyof TemplateEditorState>(key: K, value: TemplateEditorState[K]) => {
    setEditor((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    if (!editor.name.trim()) {
      message.warning("请输入模板名称");
      return;
    }
    if (!editor.content.trim()) {
      message.warning("请输入模板内容");
      return;
    }

    setSaving(true);
    try {
      const variablesJson = parseJsonText(editor.variablesText, "变量 JSON");
      const outputSchemaJson = parseJsonText(editor.outputSchemaText, "输出 Schema JSON");
      const payload = {
        name: editor.name.trim(),
        type: editor.type,
        scenario: editor.scenario,
        status: editor.status,
        version: editor.version,
        source_path: editor.sourcePath.trim() || null,
        content: editor.content,
        variables_json: variablesJson,
        output_schema_json: outputSchemaJson,
      };
      const result = editor.id
        ? await requestApi<ContentTemplateRecord>(`/api/create/templates/${editor.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await requestApi<ContentTemplateRecord>("/api/create/templates", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      setIsCreating(false);
      setEditor(editorFromTemplate(result));
      message.success(editor.id ? "模板已保存" : "模板已创建");
      await loadTemplates();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存模板失败");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!editor.id) return;

    setSaving(true);
    try {
      const result = await requestApi<ContentTemplateRecord>(`/api/create/templates/${editor.id}`, {
        method: "DELETE",
      });
      setEditor(editorFromTemplate(result));
      message.success("模板已归档");
      await loadTemplates();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "归档模板失败");
    } finally {
      setSaving(false);
    }
  };

  const handleImportXhsPrompts = async () => {
    setImporting(true);
    try {
      const result = await requestApi<ImportTemplatesResult>("/api/create/templates/import-xhs", {
        method: "POST",
      });
      message.success(`导入完成：新增 ${result.created.length} 个，更新 ${result.updated.length} 个`);
      setIsCreating(false);
      await loadTemplates();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Tag color="magenta">templates</Tag>
              <Tag>{data?.total ?? 0} 个模板</Tag>
            </div>
            <h1 className="m-0 text-2xl font-semibold tracking-normal text-slate-950 md:text-3xl">
              模板管理
            </h1>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button icon={<CloudDownloadOutlined />} loading={importing} onClick={handleImportXhsPrompts}>
              导入 xhs/prompts
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadTemplates}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建
            </Button>
          </div>
        </section>

        <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 xl:grid-cols-[minmax(180px,1fr)_180px_200px_160px_auto]">
          <Input
            allowClear
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onPressEnter={loadTemplates}
            placeholder="搜索模板"
          />
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            options={[ALL_OPTION, ...TEMPLATE_TYPE_OPTIONS]}
          />
          <Select
            value={scenarioFilter}
            onChange={setScenarioFilter}
            options={[ALL_OPTION, ...TEMPLATE_SCENARIO_OPTIONS]}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={[ALL_OPTION, ...TEMPLATE_STATUS_OPTIONS]}
          />
          <Button icon={<SearchOutlined />} onClick={loadTemplates}>
            搜索
          </Button>
        </section>

        <section className="grid min-h-[620px] gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="min-h-0 rounded-md border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-slate-950">模板列表</div>
              {loading ? <Tag>加载中</Tag> : <Tag>{templates.length}</Tag>}
            </div>

            <div className="max-h-[640px] overflow-auto p-3">
              {loading ? (
                <div className="grid gap-3">
                  <Skeleton active paragraph={{ rows: 2 }} />
                  <Skeleton active paragraph={{ rows: 2 }} />
                  <Skeleton active paragraph={{ rows: 2 }} />
                </div>
              ) : templates.length > 0 ? (
                <div className="grid gap-2">
                  {templates.map((template) => {
                    const selected = editor.id === template.id;
                    return (
                      <button
                        type="button"
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className={[
                          "w-full rounded-md border px-3 py-3 text-left transition",
                          selected
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-200 bg-white text-slate-900 hover:border-slate-400",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{template.name}</div>
                            <div className={selected ? "mt-1 text-xs text-slate-300" : "mt-1 text-xs text-slate-500"}>
                              {scenarioLabel.get(template.scenario) ?? template.scenario}
                            </div>
                          </div>
                          <Tag color={getTemplateStatusColor(template.status)}>
                            {statusLabel.get(template.status) ?? template.status}
                          </Tag>
                        </div>
                        <div className={selected ? "mt-3 flex flex-wrap gap-1 text-xs text-slate-300" : "mt-3 flex flex-wrap gap-1 text-xs text-slate-500"}>
                          <span>{typeLabel.get(template.type) ?? template.type}</span>
                          <span>v{template.version}</span>
                          <span>{formatDate(template.updated_at)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Empty description="暂无模板" />
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-md border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-950">
                  {isCreating ? "新建模板" : activeTemplate ? activeTemplate.name : "模板详情"}
                </div>
                <div className="mt-1 truncate text-xs text-slate-500">
                  {editor.sourcePath || "未绑定来源"}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {editor.id ? (
                  <Popconfirm
                    title="归档模板"
                    description="归档后不会作为默认生成模板使用，确认继续？"
                    okText="归档"
                    cancelText="取消"
                    onConfirm={handleArchive}
                  >
                    <Button danger icon={<InboxOutlined />} loading={saving}>
                      归档
                    </Button>
                  </Popconfirm>
                ) : null}
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
                  保存
                </Button>
              </div>
            </div>

            <div className="grid gap-4 p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_220px_160px_120px]">
                <div>
                  <div className="mb-2 text-xs font-medium text-slate-500">名称</div>
                  <Input
                    value={editor.name}
                    onChange={(event) => handleEditorChange("name", event.target.value)}
                    maxLength={255}
                    placeholder="模板名称"
                  />
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium text-slate-500">类型</div>
                  <Select
                    value={editor.type}
                    onChange={(value) => handleEditorChange("type", value)}
                    options={TEMPLATE_TYPE_OPTIONS}
                    className="w-full"
                  />
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium text-slate-500">场景</div>
                  <Select
                    value={editor.scenario}
                    onChange={(value) => handleEditorChange("scenario", value)}
                    options={TEMPLATE_SCENARIO_OPTIONS}
                    className="w-full"
                  />
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium text-slate-500">状态</div>
                  <Select
                    value={editor.status}
                    onChange={(value) => handleEditorChange("status", value)}
                    options={TEMPLATE_STATUS_OPTIONS}
                    className="w-full"
                  />
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium text-slate-500">版本</div>
                  <InputNumber
                    min={1}
                    value={editor.version}
                    onChange={(value) => handleEditorChange("version", value ?? 1)}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-medium text-slate-500">来源路径</div>
                <Input
                  value={editor.sourcePath}
                  onChange={(event) => handleEditorChange("sourcePath", event.target.value)}
                  maxLength={255}
                  placeholder="xhs/prompts/blog-to-xhs-note.md"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500">模板内容</span>
                  <Tooltip title="保存原始 prompt 或上下文模板">
                    <Tag>{editor.content.length} 字</Tag>
                  </Tooltip>
                </div>
                <Input.TextArea
                  value={editor.content}
                  onChange={(event) => handleEditorChange("content", event.target.value)}
                  rows={16}
                  maxLength={200000}
                  placeholder="模板内容"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-medium text-slate-500">变量 JSON</div>
                  <Input.TextArea
                    value={editor.variablesText}
                    onChange={(event) => handleEditorChange("variablesText", event.target.value)}
                    rows={10}
                    placeholder="{ }"
                  />
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium text-slate-500">输出 Schema JSON</div>
                  <Input.TextArea
                    value={editor.outputSchemaText}
                    onChange={(event) => handleEditorChange("outputSchemaText", event.target.value)}
                    rows={10}
                    placeholder="{ }"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
