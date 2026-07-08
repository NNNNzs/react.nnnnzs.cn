"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  EyeOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  ToolOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import ResponsiveTable from "@/components/ResponsiveTable";
import {
  AdminActionButton,
  AdminTableActions,
} from "@/components/admin/AdminPageHeader";

const { Text, Paragraph } = Typography;
const { Search } = Input;

interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface AiLabToolCall {
  name: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  inputSummary?: string;
  outputSummary?: string;
  success: boolean;
}

interface AiLabRunRecord {
  id: number;
  source: string;
  session_id: number | null;
  message_id: number | null;
  user_id: number | null;
  device_id: string | null;
  question: string;
  answer: string | null;
  scenario: string | null;
  style_variant: string | null;
  model: string | null;
  embedding_model: string | null;
  prompt_version: string | null;
  retriever_version: string | null;
  commit_sha: string | null;
  latency_ms: number | null;
  tool_call_count: number;
  tool_error_count: number;
  max_tool_duration_ms: number | null;
  first_tool_name: string | null;
  tool_calls: AiLabToolCall[] | null;
  feedback: string | null;
  feedback_note: string | null;
  error: string | null;
  created_at: string;
  updated_at: string | null;
  user: {
    id: number;
    nickname: string | null;
    account: string;
  } | null;
  session?: {
    id: number;
    title: string | null;
    message_count: number;
    created_at: string;
    updated_at: string;
  } | null;
}

interface AiLabRunListData {
  record: AiLabRunRecord[];
  total: number;
  pageNum: number;
  pageSize: number;
  stats: {
    avgLatencyMs: number | null;
    maxLatencyMs: number | null;
    errorCount: number;
    toolRunCount: number;
  };
}

interface QueryState {
  pageNum: number;
  pageSize: number;
  keyword: string;
  model: string;
  toolName: string;
  hasTool: string;
  hasError: string;
}

function useUrlState(): QueryState {
  const searchParams = useSearchParams();

  return useMemo(
    () => ({
      pageNum: parseInt(searchParams.get("page") || "1", 10),
      pageSize: parseInt(searchParams.get("pageSize") || "20", 10),
      keyword: searchParams.get("q") || "",
      model: searchParams.get("model") || "",
      toolName: searchParams.get("tool") || "",
      hasTool: searchParams.get("hasTool") || "all",
      hasError: searchParams.get("hasError") || "all",
    }),
    [searchParams],
  );
}

function useUpdateUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (updates: Partial<QueryState>) => {
      const next: QueryState = {
        pageNum: parseInt(searchParams.get("page") || "1", 10),
        pageSize: parseInt(searchParams.get("pageSize") || "20", 10),
        keyword: searchParams.get("q") || "",
        model: searchParams.get("model") || "",
        toolName: searchParams.get("tool") || "",
        hasTool: searchParams.get("hasTool") || "all",
        hasError: searchParams.get("hasError") || "all",
        ...updates,
      };
      const params = new URLSearchParams();

      if (next.pageNum > 1) params.set("page", String(next.pageNum));
      if (next.pageSize !== 20) params.set("pageSize", String(next.pageSize));
      if (next.keyword.trim()) params.set("q", next.keyword.trim());
      if (next.model.trim()) params.set("model", next.model.trim());
      if (next.toolName.trim()) params.set("tool", next.toolName.trim());
      if (next.hasTool !== "all") params.set("hasTool", next.hasTool);
      if (next.hasError !== "all") params.set("hasError", next.hasError);

      router.replace(params.toString() ? `${pathname}?${params}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );
}

function formatMs(value?: number | null) {
  if (typeof value !== "number") return "-";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${value}ms`;
}

function getToolCalls(run: AiLabRunRecord) {
  return Array.isArray(run.tool_calls) ? run.tool_calls : [];
}

export default function AiLabRunsPage() {
  const urlState = useUrlState();
  const updateUrl = useUpdateUrl();

  const [runs, setRuns] = useState<AiLabRunRecord[]>([]);
  const [stats, setStats] = useState<AiLabRunListData["stats"]>({
    avgLatencyMs: null,
    maxLatencyMs: null,
    errorCount: 0,
    toolRunCount: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [keywordInput, setKeywordInput] = useState(urlState.keyword);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<AiLabRunRecord | null>(null);

  useEffect(() => {
    setKeywordInput(urlState.keyword);
  }, [urlState.keyword]);

  const loadRuns = useCallback(
    async (pageNum?: number, pageSize?: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          pageNum: String(pageNum ?? urlState.pageNum),
          pageSize: String(pageSize ?? urlState.pageSize),
        });
        if (urlState.keyword) params.set("keyword", urlState.keyword);
        if (urlState.model) params.set("model", urlState.model);
        if (urlState.toolName) params.set("toolName", urlState.toolName);
        if (urlState.hasTool !== "all") params.set("hasTool", urlState.hasTool);
        if (urlState.hasError !== "all") params.set("hasError", urlState.hasError);

        const response = await fetch(`/api/admin/ai-lab/runs?${params}`, {
          cache: "no-store",
        });
        const result = await response.json() as ApiResponse<AiLabRunListData>;
        if (result.status) {
          setRuns(result.data.record || []);
          setTotal(result.data.total || 0);
          setStats(result.data.stats);
        }
      } finally {
        setLoading(false);
      }
    },
    [urlState],
  );

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const loadDetail = useCallback(async (id: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/ai-lab/runs/${id}`, {
        cache: "no-store",
      });
      const result = await response.json() as ApiResponse<AiLabRunRecord>;
      if (result.status) {
        setDetail(result.data);
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const toolOptions = useMemo(() => {
    const names = Array.from(new Set(
      runs
        .map((run) => run.first_tool_name)
        .filter((name): name is string => Boolean(name)),
    ));
    return names.map((name) => ({ label: name, value: name }));
  }, [runs]);

  const columns: TableColumnsType<AiLabRunRecord> = [
    {
      title: "Run",
      dataIndex: "id",
      width: 90,
      render: (id: number, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>#{id}</Text>
          <Tag color={record.source === "chat" ? "cyan" : "default"} className="mr-0">
            {record.source}
          </Tag>
        </Space>
      ),
    },
    {
      title: "问题",
      dataIndex: "question",
      ellipsis: true,
      render: (question: string, record) => (
        <div className="min-w-0">
          <Paragraph ellipsis={{ rows: 1 }} className="mb-1">
            {question}
          </Paragraph>
          <Text type="secondary" className="text-xs">
            {record.user ? record.user.nickname || record.user.account : record.device_id || "游客"}
          </Text>
        </div>
      ),
    },
    {
      title: "模型",
      dataIndex: "model",
      width: 180,
      ellipsis: true,
      render: (model: string | null) => model || "-",
    },
    {
      title: "工具",
      dataIndex: "first_tool_name",
      width: 160,
      render: (_: string | null, record) => (
        <Space wrap size={[4, 4]}>
          {record.tool_call_count > 0 ? (
            <>
              <Tag color="blue">{record.first_tool_name || "tool"}</Tag>
              <Tag color={record.tool_error_count > 0 ? "error" : "success"}>
                {record.tool_call_count} 次
              </Tag>
            </>
          ) : (
            <Tag>无工具</Tag>
          )}
        </Space>
      ),
    },
    {
      title: "耗时",
      dataIndex: "latency_ms",
      width: 110,
      render: (latency: number | null) => (
        <Tag color={latency && latency > 10000 ? "warning" : "default"}>
          {formatMs(latency)}
        </Tag>
      ),
    },
    {
      title: "时间",
      dataIndex: "created_at",
      width: 160,
      render: (value: string) => dayjs(value).format("MM-DD HH:mm:ss"),
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      render: (_, record) => (
        <AdminTableActions>
          <AdminActionButton
            variant="text"
            icon={<EyeOutlined />}
            onClick={() => loadDetail(record.id)}
          >
            详情
          </AdminActionButton>
        </AdminTableActions>
      ),
    },
  ];

  const renderMobileCard = (run: AiLabRunRecord) => (
    <div className="mb-3 rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Text strong>Run #{run.id}</Text>
        <Tag color={run.tool_error_count > 0 || run.error ? "error" : "cyan"} className="mr-0">
          {formatMs(run.latency_ms)}
        </Tag>
      </div>
      <Paragraph ellipsis={{ rows: 2 }} className="mb-2 text-sm">
        {run.question}
      </Paragraph>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{run.model || "-"}</span>
        <AdminActionButton variant="text" icon={<EyeOutlined />} onClick={() => loadDetail(run.id)}>
          详情
        </AdminActionButton>
      </div>
    </div>
  );

  const detailToolCalls = detail ? getToolCalls(detail) : [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 grid shrink-0 gap-3 md:grid-cols-4">
        <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3">
          <div className="text-xs text-cyan-700">Runs</div>
          <div className="mt-1 text-2xl font-semibold text-cyan-950">{total}</div>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-xs text-emerald-700">平均延迟</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-950">
            {formatMs(stats.avgLatencyMs)}
          </div>
        </div>
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
          <div className="text-xs text-blue-700">工具 Run</div>
          <div className="mt-1 text-2xl font-semibold text-blue-950">
            {stats.toolRunCount}
          </div>
        </div>
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
          <div className="text-xs text-rose-700">异常 Run</div>
          <div className="mt-1 text-2xl font-semibold text-rose-950">
            {stats.errorCount}
          </div>
        </div>
      </div>

      <div className="mb-4 flex shrink-0 flex-col gap-2 lg:flex-row">
        <Search
          allowClear
          enterButton={<SearchOutlined />}
          placeholder="搜索问题、回答、模型"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          onSearch={(value) => updateUrl({ keyword: value, pageNum: 1 })}
          className="lg:max-w-sm"
        />
        <Input
          allowClear
          placeholder="模型"
          value={urlState.model}
          onChange={(event) => updateUrl({ model: event.target.value, pageNum: 1 })}
          className="lg:max-w-[180px]"
        />
        <Select
          allowClear
          placeholder="首个工具"
          value={urlState.toolName || undefined}
          options={toolOptions}
          onChange={(value) => updateUrl({ toolName: value || "", pageNum: 1 })}
          className="lg:w-[180px]"
        />
        <Select
          value={urlState.hasTool}
          options={[
            { label: "全部调用", value: "all" },
            { label: "有工具", value: "true" },
            { label: "无工具", value: "false" },
          ]}
          onChange={(value) => updateUrl({ hasTool: value || "all", pageNum: 1 })}
          className="lg:w-[130px]"
        />
        <Select
          value={urlState.hasError}
          options={[
            { label: "全部状态", value: "all" },
            { label: "有异常", value: "true" },
            { label: "无异常", value: "false" },
          ]}
          onChange={(value) => updateUrl({ hasError: value || "all", pageNum: 1 })}
          className="lg:w-[130px]"
        />
        <Button icon={<ReloadOutlined />} onClick={() => loadRuns()} size="small">
          刷新
        </Button>
      </div>

      <ResponsiveTable
        columns={columns}
        dataSource={runs}
        rowKey="id"
        loading={loading}
        renderMobileCard={renderMobileCard}
        pagination={{
          current: urlState.pageNum,
          pageSize: urlState.pageSize,
          total,
          showTotal: (value) => `共 ${value} 条 Run`,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50", "100"],
        }}
        onChange={(pagination) => {
          updateUrl({
            pageNum: pagination.current || 1,
            pageSize: pagination.pageSize || 20,
          });
        }}
      />

      <Drawer
        title={detail ? `Run #${detail.id}` : "Run 详情"}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        size={760}
        destroyOnHidden
      >
        {detailLoading ? (
          <div className="flex justify-center py-10">
            <Spin />
          </div>
        ) : detail ? (
          <div className="space-y-5">
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="来源">{detail.source}</Descriptions.Item>
              <Descriptions.Item label="场景">{detail.scenario || "-"}</Descriptions.Item>
              <Descriptions.Item label="模型">{detail.model || "-"}</Descriptions.Item>
              <Descriptions.Item label="Embedding">{detail.embedding_model || "-"}</Descriptions.Item>
              <Descriptions.Item label="Prompt">{detail.prompt_version || "-"}</Descriptions.Item>
              <Descriptions.Item label="Retriever">{detail.retriever_version || "-"}</Descriptions.Item>
              <Descriptions.Item label="耗时">{formatMs(detail.latency_ms)}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(detail.created_at).format("YYYY-MM-DD HH:mm:ss")}
              </Descriptions.Item>
            </Descriptions>

            <section>
              <div className="mb-2 flex items-center gap-2 font-medium text-slate-800">
                <RobotOutlined />
                问题
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6">
                {detail.question}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2 font-medium text-slate-800">
                <RobotOutlined />
                回答
              </div>
              <Paragraph className="rounded-md border border-slate-200 bg-white p-3 text-sm leading-6" ellipsis={{ rows: 8, expandable: true }}>
                {detail.answer || "-"}
              </Paragraph>
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2 font-medium text-slate-800">
                <ToolOutlined />
                工具调用
              </div>
              {detailToolCalls.length > 0 ? (
                <Timeline
                  items={detailToolCalls.map((call) => ({
                    color: call.success ? "blue" : "red",
                    content: (
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Tag color={call.success ? "blue" : "error"}>{call.name}</Tag>
                          <Text type="secondary">{formatMs(call.durationMs)}</Text>
                        </div>
                        {call.inputSummary && (
                          <div className="text-sm text-slate-700">{call.inputSummary}</div>
                        )}
                        {call.outputSummary && (
                          <Paragraph ellipsis={{ rows: 3, expandable: true }} className="mt-2 mb-0 text-sm text-slate-500">
                            {call.outputSummary}
                          </Paragraph>
                        )}
                      </div>
                    ),
                  }))}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无工具调用" />
              )}
            </section>

            {detail.error && (
              <section className="rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-800">
                <WarningOutlined className="mr-2" />
                {detail.error}
              </section>
            )}
          </div>
        ) : (
          <Empty description="暂无详情" />
        )}
      </Drawer>
    </div>
  );
}
