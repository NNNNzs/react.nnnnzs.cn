"use client";

/**
 * 管理后台 - 聊天记录管理页面
 * 查看所有用户的对话记录，支持搜索、筛选、查看详情、删除
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
} from "react";
import {
  useRouter,
  useSearchParams,
  usePathname,
} from "next/navigation";
import {
  Typography,
  Button,
  Space,
  Input,
  DatePicker,
  Popconfirm,
  Tag,
  Modal,
  Card,
  Spin,
  Empty,
} from "antd";
import {
  SearchOutlined,
  DeleteOutlined,
  EyeOutlined,
  UserOutlined,
  RobotOutlined,
  ReloadOutlined,
  BulbOutlined,
} from "@ant-design/icons";
import { Bubble } from "@ant-design/x";
import XMarkdown from "@ant-design/x-markdown";
import { useAuth } from "@/contexts/AuthContext";
import { CHAT_LOG_VIEW, CHAT_LOG_DELETE } from "@/constants/permissions";
import ResponsiveTable from "@/components/ResponsiveTable";
import type { TableColumnsType } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// ============ 类型定义 ============

interface SessionRecord {
  id: number;
  title: string | null;
  message_count: number;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
  device_id: string | null;
  user: {
    id: number;
    nickname: string | null;
    account: string;
  } | null;
}

interface MessageRecord {
  id: number;
  session_id: number;
  role: string;
  content: string;
  metadata: {
    thoughts?: string[];
    reactLoops?: Array<{
      index: number;
      steps: Array<{ type: string; content: string }>;
    }>;
  } | null;
  created_at: string;
}

// ============ URL 状态管理 ============

interface QueryParams {
  pageNum: number;
  pageSize: number;
  keyword: string;
  userId: string;
  dateRange: [string, string] | null;
}

function useUrlState() {
  const searchParams = useSearchParams();
  return useMemo(
    () => ({
      pageNum: parseInt(searchParams.get("page") || "1", 10),
      pageSize: parseInt(searchParams.get("pageSize") || "20", 10),
      keyword: searchParams.get("q") || "",
      userId: searchParams.get("userId") || "",
      dateRange: searchParams.get("startDate") && searchParams.get("endDate")
        ? [searchParams.get("startDate")!, searchParams.get("endDate")!]
        : null,
    }),
    [searchParams],
  );
}

function useUpdateUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (updates: Partial<QueryParams>) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.pageNum !== undefined) params.set("page", String(updates.pageNum));
      if (updates.pageSize !== undefined) params.set("pageSize", String(updates.pageSize));
      if (updates.keyword !== undefined) {
        if (updates.keyword) params.set("q", updates.keyword);
        else params.delete("q");
      }
      if (updates.userId !== undefined) {
        if (updates.userId) params.set("userId", updates.userId);
        else params.delete("userId");
      }
      if (updates.dateRange !== undefined) {
        if (updates.dateRange) {
          params.set("startDate", updates.dateRange[0]);
          params.set("endDate", updates.dateRange[1]);
        } else {
          params.delete("startDate");
          params.delete("endDate");
        }
      }

      const newUrl = params.toString() ? `?${params.toString()}` : "";
      router.replace(`${pathname}${newUrl}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );
}

// ============ 详情弹窗 ============

const SessionDetailModal: React.FC<{
  open: boolean;
  sessionId: number | null;
  onClose: () => void;
}> = ({ open, sessionId, onClose }) => {
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSessionDetail = useCallback(
    async (targetSessionId: number) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/chat/sessions/${targetSessionId}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (data.status && data.data) {
          setMessages(data.data.messages || []);
          setSessionTitle(data.data.title);
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (open && sessionId) {
      void loadSessionDetail(sessionId);
    } else {
      setMessages([]);
      setSessionTitle(null);
    }
  }, [open, sessionId, loadSessionDetail]);

  const bubbleItems = useMemo(() => {
    return messages.map((msg) => ({
      key: msg.id,
      role: msg.role === "user" ? "user" : "ai",
      content:
        msg.role === "user" ? (
          msg.content
        ) : (
          <div>
            {msg.metadata?.reactLoops && msg.metadata.reactLoops.length > 0 && (
              <div className="mb-3 text-sm">
                {msg.metadata.reactLoops.map((loop) => (
                  <div key={loop.index} className="mb-2">
                    <Tag color="blue">第 {loop.index} 轮检索</Tag>
                    <div className="mt-1 space-y-1">
                      {loop.steps.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-1 text-xs text-gray-500">
                          {step.type === "thought" && <BulbOutlined className="mt-0.5" style={{ color: "#faad14" }} />}
                          {step.type === "action" && <SearchOutlined className="mt-0.5" style={{ color: "#1890ff" }} />}
                          {step.content}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {msg.content && <XMarkdown>{msg.content}</XMarkdown>}
          </div>
        ),
    }));
  }, [messages]);

  const roles = useMemo(
    () => ({
      ai: {
        placement: "start" as const,
        avatar: () => <RobotOutlined />,
      },
      user: {
        placement: "end" as const,
        avatar: () => <UserOutlined />,
      },
    }),
    [],
  );

  return (
    <Modal
      title={sessionTitle ? `对话详情 - ${sessionTitle}` : "对话详情"}
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      styles={{ body: { maxHeight: "60vh", overflowY: "auto" } }}
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spin />
        </div>
      ) : messages.length === 0 ? (
        <Empty description="暂无消息" />
      ) : (
        <Bubble.List role={roles} items={bubbleItems} />
      )}
    </Modal>
  );
};

// ============ 主页面 ============

function PageContent() {
  const { user, hasPermission } = useAuth();
  const urlState = useUrlState();
  const updateUrl = useUpdateUrl();

  const [data, setData] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState(urlState.keyword);
  const [userIdInput, setUserIdInput] = useState(urlState.userId);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSessionId, setDetailSessionId] = useState<number | null>(null);

  /**
   * 加载数据
   */
  const loadData = useCallback(
    async (pageNum?: number, pageSize?: number) => {
      if (!user || !hasPermission(CHAT_LOG_VIEW)) return;

      try {
        setLoading(true);
        const params = new URLSearchParams({
          pageNum: String(pageNum ?? urlState.pageNum),
          pageSize: String(pageSize ?? urlState.pageSize),
        });
        if (urlState.keyword) params.set("keyword", urlState.keyword);
        if (urlState.userId) params.set("userId", urlState.userId);
        if (urlState.dateRange) {
          params.set("startDate", urlState.dateRange[0]);
          params.set("endDate", urlState.dateRange[1]);
        }

        const response = await fetch(`/api/admin/chat-logs?${params}`, {
          cache: "no-store",
        });
        if (response.ok) {
          const result = await response.json();
          if (result.status) {
            setData(result.data.record || []);
            setTotal(result.data.total || 0);
          }
        }
      } catch {
        // 静默失败
      } finally {
        setLoading(false);
      }
    },
    [user, hasPermission, urlState],
  );

  /**
   * URL 状态变化时重新加载数据
   */
  useEffect(() => {
    if (user && hasPermission(CHAT_LOG_VIEW)) {
      loadData();
    }
  }, [user, urlState.pageNum, urlState.pageSize, urlState.keyword, urlState.userId, urlState.dateRange, hasPermission, loadData]);

  /**
   * 批量删除
   */
  const handleBatchDelete = useCallback(async () => {
    if (selectedRowKeys.length === 0) return;

    try {
      const response = await fetch("/api/admin/chat-logs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedRowKeys }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status) {
          setSelectedRowKeys([]);
          loadData();
        }
      }
    } catch {
      // 静默失败
    }
  }, [selectedRowKeys, loadData]);

  /**
   * 表格列定义
   */
  const columns: TableColumnsType<SessionRecord> = useMemo(
    () => [
      {
        title: "ID",
        dataIndex: "id",
        key: "id",
        width: 60,
      },
      {
        title: "用户",
        key: "user",
        width: 120,
        render: (_, record) =>
          record.user ? (
            <div>
              <div className="text-sm">{record.user.nickname || record.user.account}</div>
              <div className="text-xs text-gray-400">ID: {record.user.id}</div>
            </div>
          ) : (
            <Tag color="orange">游客</Tag>
          ),
      },
      {
        title: "会话标题",
        dataIndex: "title",
        key: "title",
        ellipsis: true,
        render: (title: string | null) => title || <Text type="secondary">无标题</Text>,
      },
      {
        title: "消息数",
        dataIndex: "message_count",
        key: "message_count",
        width: 80,
        align: "center",
      },
      {
        title: "IP",
        dataIndex: "ip_address",
        key: "ip_address",
        width: 120,
        ellipsis: true,
        render: (ip: string | null) => ip || "-",
      },
      {
        title: "更新时间",
        dataIndex: "updated_at",
        key: "updated_at",
        width: 160,
        render: (date: string) => dayjs(date).format("YYYY-MM-DD HH:mm"),
      },
      {
        title: "操作",
        key: "action",
        width: 120,
        render: (_, record) => (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setDetailSessionId(record.id);
                setDetailOpen(true);
              }}
            >
              详情
            </Button>
            {hasPermission(CHAT_LOG_DELETE) && (
              <Popconfirm
                title="确定删除此对话记录？"
                onConfirm={async () => {
                  const res = await fetch("/api/admin/chat-logs", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ids: [record.id] }),
                  });
                  if (res.ok) loadData();
                }}
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ],
    [hasPermission, loadData],
  );

  /**
   * 移动端卡片渲染
   */
  const renderMobileCard = (record: SessionRecord) => (
    <Card size="small" className="mb-2">
      <div className="flex justify-between mb-2">
        <Text strong className="truncate flex-1">{record.title || "无标题"}</Text>
        <Text type="secondary" className="text-xs ml-2 shrink-0">
          {record.message_count}条
        </Text>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        {record.user ? (
          <span>{record.user.nickname || record.user.account}</span>
        ) : (
          <Tag color="orange" className="text-xs">游客</Tag>
        )}
        {record.ip_address && <span>{record.ip_address}</span>}
      </div>
      <div className="flex items-center justify-between">
        <Text type="secondary" className="text-xs">
          {dayjs(record.updated_at).format("YYYY-MM-DD HH:mm")}
        </Text>
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setDetailSessionId(record.id);
              setDetailOpen(true);
            }}
          />
          {hasPermission(CHAT_LOG_DELETE) && (
            <Popconfirm
              title="确定删除？"
              onConfirm={async () => {
                const res = await fetch("/api/admin/chat-logs", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ids: [record.id] }),
                });
                if (res.ok) loadData();
              }}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      </div>
    </Card>
  );

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        {/* 标题栏 */}
        <div className="mb-4 flex items-center justify-between">
          <Title level={3} className="mb-0">
            聊天记录
          </Title>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => loadData()}>
              刷新
            </Button>
          </Space>
        </div>

        {/* 搜索和筛选 */}
        <div className="mb-4 flex flex-wrap gap-3">
          <Input.Search
            placeholder="搜索标题/用户/内容"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={(value) => {
              updateUrl({ keyword: value, pageNum: 1 });
            }}
            style={{ width: 220 }}
            allowClear
          />
          <Input
            placeholder="用户ID"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
            onPressEnter={() => {
              updateUrl({ userId: userIdInput, pageNum: 1 });
            }}
            style={{ width: 120 }}
            allowClear
            onClear={() => {
              setUserIdInput("");
              updateUrl({ userId: "", pageNum: 1 });
            }}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              setDateRange(dates as [Dayjs | null, Dayjs | null] | null);
              if (dates && dates[0] && dates[1]) {
                updateUrl({
                  dateRange: [
                    dates[0].format("YYYY-MM-DD"),
                    dates[1].format("YYYY-MM-DD"),
                  ],
                  pageNum: 1,
                });
              } else {
                updateUrl({ dateRange: null, pageNum: 1 });
              }
            }}
            style={{ width: 240 }}
          />
          {selectedRowKeys.length > 0 && hasPermission(CHAT_LOG_DELETE) && (
            <Popconfirm
              title={`确定删除选中的 ${selectedRowKeys.length} 条记录？`}
              onConfirm={handleBatchDelete}
            >
              <Button danger icon={<DeleteOutlined />}>
                删除选中 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
        </div>

        {/* 数据列表 */}
        <ResponsiveTable
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          renderMobileCard={renderMobileCard}
          rowSelection={
            hasPermission(CHAT_LOG_DELETE)
              ? {
                  selectedRowKeys,
                  onChange: setSelectedRowKeys,
                }
              : undefined
          }
          pagination={{
            current: urlState.pageNum,
            pageSize: urlState.pageSize,
            total,
            showTotal: (t) => `共 ${t} 条`,
            showSizeChanger: true,
          }}
          onChange={(pagination) => {
            updateUrl({
              pageNum: pagination.current || 1,
              pageSize: pagination.pageSize || 20,
            });
          }}
        />
      </div>

      {/* 详情弹窗 */}
      <SessionDetailModal
        open={detailOpen}
        sessionId={detailSessionId}
        onClose={() => {
          setDetailOpen(false);
          setDetailSessionId(null);
        }}
      />
    </div>
  );
}

/**
 * 用 Suspense 包裹以支持 useSearchParams
 */
export default function ChatLogsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Spin />
        </div>
      }
    >
      <PageContent />
    </Suspense>
  );
}
