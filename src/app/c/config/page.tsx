/**
 * 配置管理页面
 * 路由: /c/config
 */

"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  message,
  Modal,
  Form,
  Select,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import { useAuth } from "@/contexts/AuthContext";
import type { QueryConfigCondition } from "@/dto/config.dto";
import type { TbConfig } from "@/generated/prisma-client";
import { isAdmin } from "@/types/role";

const { Search } = Input;
const { confirm } = Modal;
const { TextArea } = Input;

/**
 * 配置类型定义（使用实体类型）
 */
type Config = TbConfig;

/**
 * 从 URL 查询参数中读取状态
 */
function useUrlState() {
  const searchParams = useSearchParams();

  return {
    searchText: searchParams.get("q") || "",
    statusFilter: searchParams.get("status") || "all",
    current: parseInt(searchParams.get("page") || "1", 10),
    pageSize: parseInt(searchParams.get("pageSize") || "20", 10),
  };
}

/**
 * 查询参数类型定义
 */
interface QueryParams {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

/**
 * 更新 URL 查询参数
 */
function useUpdateUrl() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return useCallback(
    (updates: Partial<QueryParams>) => {
      const currentParams: QueryParams = {
        q: searchParams.get("q") || undefined,
        status: searchParams.get("status") || undefined,
        page: searchParams.get("page")
          ? parseInt(searchParams.get("page")!, 10)
          : undefined,
        pageSize: searchParams.get("pageSize")
          ? parseInt(searchParams.get("pageSize")!, 10)
          : undefined,
      };

      const mergedParams: QueryParams = {
        ...currentParams,
        ...updates,
      };

      const params = new URLSearchParams();

      if (mergedParams.q && mergedParams.q.trim()) {
        params.set("q", mergedParams.q.trim());
      }

      if (mergedParams.status && mergedParams.status !== "all") {
        params.set("status", mergedParams.status);
      }

      if (mergedParams.page && mergedParams.page > 1) {
        params.set("page", mergedParams.page.toString());
      }

      if (mergedParams.pageSize && mergedParams.pageSize !== 20) {
        params.set("pageSize", mergedParams.pageSize.toString());
      }

      const newUrl = params.toString() ? `?${params.toString()}` : "";
      router.replace(`/c/config${newUrl}`, { scroll: false });
    },
    [router, searchParams]
  );
}

function ConfigPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const urlState = useUrlState();
  const updateUrl = useUpdateUrl();

  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchInputValue, setSearchInputValue] = useState(urlState.searchText);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Config | null>(null);
  const [form] = Form.useForm();

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableScrollHeight, setTableScrollHeight] = useState<
    number | undefined
  >(undefined);

  const statusFilter = urlState.statusFilter;

  /**
   * 检查权限
   */
  useEffect(() => {
    if (user && !isAdmin(user.role)) {
      message.error("无权限访问");
      router.push("/c");
    }
  }, [user, router]);

  const pagination = useMemo(
    () => ({
      current: urlState.current,
      pageSize: urlState.pageSize,
      total: total,
    }),
    [urlState, total]
  );

  /**
   * 动态计算表格滚动高度
   */
  useEffect(() => {
    const updateScrollHeight = () => {
      if (tableContainerRef.current) {
        const containerHeight = tableContainerRef.current.clientHeight;
        if (containerHeight > 0) {
          const scrollHeight = containerHeight - 104;
          setTableScrollHeight(Math.max(scrollHeight, 300));
        }
      }
    };

    updateScrollHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateScrollHeight();
    });

    if (tableContainerRef.current) {
      resizeObserver.observe(tableContainerRef.current);
    }

    window.addEventListener("resize", updateScrollHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScrollHeight);
    };
  }, []);

  /**
   * 当 URL 中的搜索关键词变化时，同步搜索框的值
   */
  useEffect(() => {
    setSearchInputValue(urlState.searchText);
  }, [urlState.searchText]);

  // 登录检查已在布局组件中处理，这里不需要重复检查

  /**
   * 加载配置列表
   */
  const loadConfigs = useCallback(
    async (pageNum?: number, pageSize?: number) => {
      try {
        setLoading(true);

        const currentPage = pageNum ?? urlState.current;
        const currentPageSize = pageSize ?? urlState.pageSize;

        const params: QueryConfigCondition = {
          pageNum: currentPage,
          pageSize: currentPageSize,
          ...(urlState.searchText && { query: urlState.searchText }),
          ...(urlState.statusFilter &&
            urlState.statusFilter !== "all" && {
              status: Number(urlState.statusFilter),
            }),
        };

        const response = await axios.get("/api/config/list", { params });

        if (response.data.status) {
          const data = response.data.data;
          setConfigs(data.record || []);
          setTotal(data.total || 0);
        }
      } catch (error) {
        console.error("加载配置失败:", error);
        message.error("加载配置失败");
      } finally {
        setLoading(false);
      }
    },
    [urlState]
  );

  /**
   * 删除配置
   */
  const handleDelete = (config: Config) => {
    confirm({
      title: "确认删除",
      content: `确定要删除配置《${config.title || config.key}》吗？`,
      okText: "确定",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        try {
          const response = await axios.delete(`/api/config/${config.id}`);
          if (response.data.status) {
            message.success("删除成功");
            loadConfigs(urlState.current, urlState.pageSize);
          } else {
            message.error(response.data.message || "删除失败");
          }
        } catch (error) {
          console.error("删除配置失败:", error);
          message.error("删除失败");
        }
      },
    });
  };

  /**
   * 编辑配置
   */
  const handleEdit = (config: Config) => {
    setEditingConfig(config);
    form.setFieldsValue({
      title: config.title,
      key: config.key,
      value: config.value,
      status: config.status,
      remark: config.remark,
    });
    setIsModalOpen(true);
  };

  /**
   * 创建新配置
   */
  const handleCreate = () => {
    setEditingConfig(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  /**
   * 保存配置（创建或更新）
   */
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      if (editingConfig) {
        // 更新
        const response = await axios.put(
          `/api/config/${editingConfig.id}`,
          values
        );
        if (response.data.status) {
          message.success("更新成功");
          setIsModalOpen(false);
          loadConfigs(urlState.current, urlState.pageSize);
        } else {
          message.error(response.data.message || "更新失败");
        }
      } else {
        // 创建
        const response = await axios.post("/api/config", values);
        if (response.data.status) {
          message.success("创建成功");
          setIsModalOpen(false);
          loadConfigs(urlState.current, urlState.pageSize);
        } else {
          message.error(response.data.message || "创建失败");
        }
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        console.error("保存配置失败:", error);
        message.error("保存失败");
      }
    }
  };

  /**
   * 统一的查询参数更新方法
   */
  const updateQueryParams = useCallback(
    (updates: Partial<QueryParams>) => {
      updateUrl(updates);
    },
    [updateUrl]
  );

  /**
   * 当 URL 状态变化时，重新加载数据
   */
  useEffect(() => {
    if (user && isAdmin(user.role)) {
      loadConfigs(urlState.current, urlState.pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    urlState.current,
    urlState.pageSize,
    urlState.statusFilter,
    urlState.searchText,
  ]);

  /**
   * 表格列定义
   */
  const columns: TableColumnsType<Config> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 80,
    },
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
    },
    {
      title: "Key",
      dataIndex: "key",
      key: "key",
      ellipsis: true,
    },
    {
      title: "Value",
      dataIndex: "value",
      key: "value",
      ellipsis: true,
      render: (value: string | null) => (
        <span className="max-w-xs truncate block" title={value || ""}>
          {value || "-"}
        </span>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: number | null) => (
        <Tag color={status === 1 ? "success" : "default"}>
          {status === 1 ? "启用" : "禁用"}
        </Tag>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string | Date | null) =>
        date ? dayjs(date).format("YYYY-MM-DD HH:mm") : "-",
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      key: "updated_at",
      render: (date: string | Date | null) =>
        date ? dayjs(date).format("YYYY-MM-DD HH:mm") : "-",
    },
    {
      title: "最后读取",
      dataIndex: "last_read_at",
      key: "last_read_at",
      render: (date: string | Date | null) =>
        date ? dayjs(date).format("YYYY-MM-DD HH:mm") : "-",
    },
    {
      title: "备注",
      dataIndex: "remark",
      key: "remark",
      ellipsis: true,
      render: (remark: string | null) => (
        <span className="max-w-xs truncate block" title={remark || ""}>
          {remark || "-"}
        </span>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 150,
      fixed: "right" as const,
      render: (_: unknown, record: Config) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="mb-6 flex items-center justify-between shrink-0">
          <h1 className="text-2xl font-bold">配置管理</h1>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            size="large"
          >
            创建新配置
          </Button>
        </div>

        {/* 搜索和筛选 */}
        <div className="mb-4 flex gap-4 shrink-0">
          <Search
            placeholder="搜索标题或Key"
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            value={searchInputValue}
            onSearch={(value) => updateQueryParams({ q: value, page: 1 })}
            onChange={(e) => setSearchInputValue(e.target.value)}
            style={{ maxWidth: 400 }}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            size="large"
            style={{ width: 120 }}
            value={statusFilter === "all" ? undefined : statusFilter}
            onChange={(value) =>
              updateQueryParams({ status: value || "all", page: 1 })
            }
            options={[
              { label: "全部", value: "all" },
              { label: "启用", value: "1" },
              { label: "禁用", value: "0" },
            ]}
          />
        </div>

        {/* 配置列表 */}
        <div ref={tableContainerRef} className="flex-1 flex flex-col min-h-0">
          <Table
            columns={columns}
            dataSource={configs}
            rowKey="id"
            loading={loading}
            scroll={tableScrollHeight ? { y: tableScrollHeight } : undefined}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showTotal: (total) => `共 ${total} 条配置`,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ["10", "20", "50", "100"],
            }}
            onChange={(paginationConfig) => {
              updateQueryParams({
                page: paginationConfig.current || 1,
                pageSize: paginationConfig.pageSize || 20,
              });
            }}
          />
        </div>
      </div>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingConfig ? "编辑配置" : "创建配置"}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={700}
        styles={{
          header: { zIndex: 1001 },
          mask: { backgroundColor: "rgba(0, 0, 0, 0.45)" },
          body: { zIndex: 1000 },
        }}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            status: 1,
          }}
        >
          <Form.Item
            label="标题"
            name="title"
            rules={[{ required: true, message: "请输入标题" }]}
          >
            <Input placeholder="请输入标题" maxLength={20} />
          </Form.Item>
          <Form.Item
            label="Key"
            name="key"
            rules={[{ required: true, message: "请输入Key" }]}
          >
            <Input
              placeholder="请输入Key"
              maxLength={20}
              disabled={!!editingConfig}
            />
          </Form.Item>
          <Form.Item label="Value" name="value">
            <TextArea placeholder="请输入Value" rows={4} showCount />
          </Form.Item>
          <Form.Item
            label="状态"
            name="status"
            rules={[{ required: true, message: "请选择状态" }]}
          >
            <Select placeholder="请选择状态">
              <Select.Option value={1}>启用</Select.Option>
              <Select.Option value={0}>禁用</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <TextArea placeholder="请输入备注" rows={3} showCount />
          </Form.Item>
          {editingConfig && (
            <>
              <Form.Item label="创建时间">
                <Input
                  value={
                    editingConfig.created_at
                      ? dayjs(editingConfig.created_at).format(
                          "YYYY-MM-DD HH:mm:ss"
                        )
                      : "-"
                  }
                  disabled
                />
              </Form.Item>
              <Form.Item label="更新时间">
                <Input
                  value={
                    editingConfig.updated_at
                      ? dayjs(editingConfig.updated_at).format(
                          "YYYY-MM-DD HH:mm:ss"
                        )
                      : "-"
                  }
                  disabled
                />
              </Form.Item>
              <Form.Item label="最后读取时间">
                <Input
                  value={
                    editingConfig.last_read_at
                      ? dayjs(editingConfig.last_read_at).format(
                          "YYYY-MM-DD HH:mm:ss"
                        )
                      : "-"
                  }
                  disabled
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}

/**
 * 默认导出组件，使用 Suspense 包裹以支持 useSearchParams
 */
export default function ConfigPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div>加载中...</div>
        </div>
      }
    >
      <ConfigPageContent />
    </Suspense>
  );
}
