/**
 * 单项配置 Tab
 * 从 /c/config/page.tsx 抽取的原始配置管理列表
 */

"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Input,
  Tag,
  message,
  Modal,
  Form,
  Select,
  Card,
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
import { CONFIG_VIEW, CONFIG_EDIT } from "@/constants/permissions";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import ResponsiveTable from "@/components/ResponsiveTable";
import {
  AdminActionButton,
  AdminTableActions,
} from "@/components/admin/AdminPageHeader";
import type { QueryConfigCondition } from "@/dto/config.dto";
import type { TbConfig } from "@/generated/prisma-client/client";

const { Search } = Input;
const { confirm } = Modal;
const { TextArea } = Input;

type Config = TbConfig;

function useUrlState() {
  const searchParams = useSearchParams();

  return useMemo(() => ({
    searchText: searchParams.get("q") || "",
    statusFilter: searchParams.get("status") || "all",
    current: parseInt(searchParams.get("page") || "1", 10),
    pageSize: parseInt(searchParams.get("pageSize") || "20", 10),
  }), [searchParams]);
}

interface QueryParams {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

function useUpdateUrl() {
  const router = useRouter();
  const pathname = usePathname();
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
      router.replace(`${pathname}${newUrl}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );
}

function ConfigListTabContent() {
  const { user, hasPermission } = useAuth();
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
  const { isMobile } = useBreakpoint();

  const statusFilter = urlState.statusFilter;

  useEffect(() => {
    if (user && !hasPermission(CONFIG_VIEW)) {
      message.error("无权限访问配置管理");
      router.push("/c/post");
    }
  }, [user, hasPermission, router]);

  const pagination = useMemo(
    () => ({
      current: urlState.current,
      pageSize: urlState.pageSize,
      total: total,
    }),
    [urlState, total]
  );

  useEffect(() => {
    setSearchInputValue(urlState.searchText);
  }, [urlState.searchText]);

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

  const handleCreate = () => {
    setEditingConfig(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      if (editingConfig) {
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

  const updateQueryParams = useCallback(
    (updates: Partial<QueryParams>) => {
      updateUrl(updates);
    },
    [updateUrl]
  );

  useEffect(() => {
    if (user && hasPermission(CONFIG_EDIT)) {
      loadConfigs(urlState.current, urlState.pageSize);
    }
  }, [
    user,
    hasPermission,
    loadConfigs,
    urlState,
  ]);

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
        <AdminTableActions>
          <AdminActionButton
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </AdminActionButton>
          <AdminActionButton
            color="danger"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </AdminActionButton>
        </AdminTableActions>
      ),
    },
  ];

  const renderMobileCard = (record: Config) => (
    <Card size="small" className="mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-base truncate flex-1 mr-2">
          {record.title || record.key}
        </span>
        <Tag color={record.status === 1 ? "success" : "default"}>
          {record.status === 1 ? "启用" : "禁用"}
        </Tag>
      </div>
      <div className="mb-2">
        <div className="font-mono text-sm text-gray-500 truncate">
          {record.key}
        </div>
        {record.remark && (
          <div className="text-sm text-gray-400 line-clamp-2 mt-1">
            {record.remark}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {record.updated_at
            ? dayjs(record.updated_at).format("YYYY-MM-DD HH:mm")
            : "-"}
        </span>
        <AdminTableActions>
          <AdminActionButton
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </AdminActionButton>
          <AdminActionButton
            color="danger"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </AdminActionButton>
        </AdminTableActions>
      </div>
    </Card>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 搜索和筛选 */}
      <div
        className={`mb-4 shrink-0 ${
          isMobile ? "flex flex-col gap-2" : "flex gap-4"
        }`}
      >
        <Search
          placeholder="搜索标题或Key"
          allowClear
          enterButton={<SearchOutlined />}
          size="middle"
          value={searchInputValue}
          onSearch={(value) => updateQueryParams({ q: value, page: 1 })}
          onChange={(e) => setSearchInputValue(e.target.value)}
          style={isMobile ? { width: "100%" } : { maxWidth: 400 }}
        />
        <Button
          variant="solid"
          color="primary"
          icon={<PlusOutlined />}
          size="middle"
          onClick={handleCreate}
        >
          新建
        </Button>
        <Select
          placeholder="状态筛选"
          allowClear
          size="middle"
          style={isMobile ? { width: "100%" } : { width: 120 }}
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
      <ResponsiveTable
        columns={columns}
        dataSource={configs}
        rowKey="id"
        loading={loading}
        renderMobileCard={renderMobileCard}
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
        forceRender
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
              maxLength={100}
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

export default function ConfigListTab() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <ConfigListTabContent />
    </Suspense>
  );
}
