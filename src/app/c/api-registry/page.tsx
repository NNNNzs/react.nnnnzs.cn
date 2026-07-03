/**
 * API 接口注册表管理页面
 * 路由: /c/api-registry
 *
 * 管理接口的 MCP 工具暴露配置、关联权限码等。
 */

"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Button,
  Input,
  Space,
  Tag,
  message,
  Modal,
  Form,
  Select,
  Switch,
  Card,
  Tooltip,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  EditOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import axios from "axios";
import ResponsiveTable from "@/components/ResponsiveTable";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { MODULE_LABELS, MODULE_COLORS } from "@/constants/permissions";

const { Search } = Input;

const METHOD_COLORS: Record<string, string> = {
  GET: "blue",
  POST: "green",
  PUT: "orange",
  DELETE: "red",
  PATCH: "purple",
};

function useUrlState() {
  const searchParams = useSearchParams();

  return useMemo(() => ({
    searchText: searchParams.get("q") || "",
    moduleFilter: searchParams.get("module") || "",
    mcpFilter: searchParams.get("mcp_enabled") || "",
    current: parseInt(searchParams.get("page") || "1", 10),
    pageSize: parseInt(searchParams.get("pageSize") || "20", 10),
  }), [searchParams]);
}

interface QueryParams {
  q?: string;
  module?: string;
  mcp_enabled?: string;
  page?: number;
  pageSize?: number;
}

function useUpdateUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback((updates: Partial<QueryParams>) => {
    const currentParams: QueryParams = {
      q: searchParams.get("q") || undefined,
      module: searchParams.get("module") || undefined,
      mcp_enabled: searchParams.get("mcp_enabled") || undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : undefined,
      pageSize: searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!, 10) : undefined,
    };

    const mergedParams: QueryParams = {
      ...currentParams,
      ...updates,
    };

    const params = new URLSearchParams();

    if (mergedParams.q && mergedParams.q.trim()) {
      params.set("q", mergedParams.q.trim());
    }
    if (mergedParams.module && mergedParams.module.trim()) {
      params.set("module", mergedParams.module);
    }
    if (mergedParams.mcp_enabled && mergedParams.mcp_enabled.trim()) {
      params.set("mcp_enabled", mergedParams.mcp_enabled);
    }
    if (mergedParams.page && mergedParams.page > 1) {
      params.set("page", mergedParams.page.toString());
    }
    if (mergedParams.pageSize && mergedParams.pageSize !== 20) {
      params.set("pageSize", mergedParams.pageSize.toString());
    }

    const newUrl = params.toString() ? `?${params.toString()}` : "";
    router.replace(`${pathname}${newUrl}`, { scroll: false });
  }, [router, pathname, searchParams]);
}

interface ApiRegistryItem {
  id: number;
  code: string;
  name: string;
  description: string | null;
  module: string;
  api_path: string;
  api_method: string;
  permission_code: string | null;
  mcp_enabled: number;
  mcp_available: number;
  mcp_tool_name: string | null;
  input_schema: string | null;
  cache_tags: string | null;
  status: number;
  sort_order: number;
}

function ApiRegistryPageContent() {
  const { isMobile } = useBreakpoint();
  const urlState = useUrlState();
  const updateUrl = useUpdateUrl();

  const [apis, setApis] = useState<ApiRegistryItem[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchInputValue, setSearchInputValue] = useState(urlState.searchText);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingApi, setEditingApi] = useState<ApiRegistryItem | null>(null);
  const [mcpDetailApi, setMcpDetailApi] = useState<ApiRegistryItem | null>(null);
  const [editForm] = Form.useForm();
  const [editLoading, setEditLoading] = useState(false);

  const [allPermissions, setAllPermissions] = useState<{ code: string; name: string }[]>([]);

  const pagination = useMemo(() => ({
    current: urlState.current,
    pageSize: urlState.pageSize,
    total: total,
  }), [urlState, total]);

  useEffect(() => {
    setSearchInputValue(urlState.searchText);
  }, [urlState.searchText]);

  const loadApis = useCallback(async (pageNum?: number, pageSize?: number) => {
    try {
      setLoading(true);

      const currentPage = pageNum ?? urlState.current;
      const currentPageSize = pageSize ?? urlState.pageSize;

      const params: Record<string, string | number> = {
        pageNum: currentPage,
        pageSize: currentPageSize,
      };

      if (urlState.searchText) {
        params.query = urlState.searchText;
      }
      if (urlState.moduleFilter) {
        params.module = urlState.moduleFilter;
      }
      if (urlState.mcpFilter) {
        params.mcp_enabled = urlState.mcpFilter;
      }

      const response = await axios.get("/api/admin/api-registry", { params });
      if (response.data.status) {
        const data = response.data.data;
        setApis(data.record || []);
        setTotal(data.total || 0);
        setModules(data.modules || []);
      }
    } catch (error) {
      console.error("加载接口列表失败:", error);
      message.error("加载接口列表失败");
    } finally {
      setLoading(false);
    }
  }, [urlState]);

  const loadPermissions = useCallback(async () => {
    try {
      const response = await axios.get("/api/admin/permissions");
      if (response.data.status) {
        setAllPermissions(
          (response.data.data.list || []).map((p: { code: string; name: string }) => ({
            code: p.code,
            name: p.name,
          }))
        );
      }
    } catch (error) {
      console.error("加载权限码失败:", error);
    }
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const updateQueryParams = useCallback((updates: Partial<QueryParams>) => {
    updateUrl(updates);
  }, [updateUrl]);

  useEffect(() => {
    loadApis(urlState.current, urlState.pageSize);
  }, [loadApis, urlState]);

  const handleToggleMcp = async (record: ApiRegistryItem, enabled: boolean) => {
    try {
      const response = await axios.put("/api/admin/api-registry", {
        id: record.id,
        mcp_enabled: enabled ? 1 : 0,
      });
      if (response.data.status) {
        message.success(enabled ? "已启用 MCP" : "已禁用 MCP");
        loadApis();
      } else {
        message.error(response.data.message || "操作失败");
      }
    } catch {
      message.error("操作失败");
    }
  };

  const handleEdit = (record: ApiRegistryItem) => {
    setEditingApi(record);
    editForm.setFieldsValue({
      mcp_enabled: record.mcp_enabled === 1,
      mcp_tool_name: record.mcp_tool_name || "",
      permission_code: record.permission_code || undefined,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingApi) return;

    try {
      setEditLoading(true);
      const values = await editForm.validateFields();

      const updateData: Record<string, unknown> = { id: editingApi.id };
      if (values.mcp_enabled !== undefined) {
        updateData.mcp_enabled = values.mcp_enabled ? 1 : 0;
      }
      if (values.mcp_tool_name !== undefined) {
        updateData.mcp_tool_name = values.mcp_tool_name || null;
      }
      if (values.permission_code !== undefined) {
        updateData.permission_code = values.permission_code || null;
      }

      const response = await axios.put("/api/admin/api-registry", updateData);
      if (response.data.status) {
        message.success("保存成功");
        setIsEditModalOpen(false);
        loadApis();
      } else {
        message.error(response.data.message || "保存失败");
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error("保存失败");
      }
    } finally {
      setEditLoading(false);
    }
  };

  const columns: TableColumnsType<ApiRegistryItem> = [
    {
      title: "编码",
      dataIndex: "code",
      key: "code",
      width: 130,
      render: (code: string) => <Tag className="font-mono">{code}</Tag>,
    },
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      width: 120,
    },
    {
      title: "模块",
      dataIndex: "module",
      key: "module",
      width: 80,
      render: (module: string) => (
        <Tag color={MODULE_COLORS[module] || "default"}>
          {MODULE_LABELS[module] || module}
        </Tag>
      ),
    },
    {
      title: "方法/路径",
      key: "api",
      width: 220,
      render: (_: unknown, record: ApiRegistryItem) => (
        <Space size={4}>
          <Tag color={METHOD_COLORS[record.api_method] || "default"}>
            {record.api_method}
          </Tag>
          <span className="font-mono text-xs text-gray-500">{record.api_path}</span>
        </Space>
      ),
    },
    {
      title: "权限码",
      dataIndex: "permission_code",
      key: "permission_code",
      width: 120,
      render: (code: string | null) =>
        code ? <Tag>{code}</Tag> : <span className="text-gray-300">-</span>,
    },
    {
      title: "MCP 工具名",
      dataIndex: "mcp_tool_name",
      key: "mcp_tool_name",
      width: 140,
      render: (name: string | null, record: ApiRegistryItem) =>
        name ? (
          <Tag
            color="blue"
            className="cursor-pointer"
            onClick={() => setMcpDetailApi(record)}
          >
            {name}
          </Tag>
        ) : <span className="text-gray-300">-</span>,
    },
    {
      title: "MCP",
      dataIndex: "mcp_enabled",
      key: "mcp_enabled",
      width: 70,
      render: (enabled: number, record: ApiRegistryItem) => (
        <Tooltip title={record.mcp_available === 0 ? "该接口未实现 MCP handler" : ""}>
          <Switch
            size="small"
            checked={enabled === 1}
            disabled={record.mcp_available === 0}
            onChange={(checked) => handleToggleMcp(record, checked)}
          />
        </Tooltip>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 80,
      fixed: "right" as const,
      render: (_: unknown, record: ApiRegistryItem) => (
        <Button variant="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => handleEdit(record)}
        >
          配置
        </Button>
      ),
    },
  ];

  const renderMobileCard = (record: ApiRegistryItem) => (
    <Card size="small" className="mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-base">{record.name}</span>
        <Space>
          <Tag color={MODULE_COLORS[record.module] || "default"}>
            {MODULE_LABELS[record.module] || record.module}
          </Tag>
          {record.mcp_enabled === 1 && <Tag color="blue">MCP</Tag>}
        </Space>
      </div>
      <div className="text-gray-500 text-sm mb-1">
        <Tag className="font-mono text-xs">{record.code}</Tag>
        <Tag color={METHOD_COLORS[record.api_method] || "default"}>
          {record.api_method}
        </Tag>
        <span className="font-mono text-xs">{record.api_path}</span>
      </div>
      {record.mcp_tool_name && (
        <div
          className="text-blue-500 text-xs mb-2 cursor-pointer hover:underline"
          onClick={() => setMcpDetailApi(record)}
        >
          MCP: {record.mcp_tool_name}
        </div>
      )}
      <div className="flex items-center justify-between">
        <Switch
          size="small"
          checked={record.mcp_enabled === 1}
          disabled={record.mcp_available === 0}
          onChange={(checked) => handleToggleMcp(record, checked)}
        />
        <Button variant="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          配置
        </Button>
      </div>
    </Card>
  );

  return (
    <>
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        {/* 标题栏 */}
        <div className={`mb-4 shrink-0 ${isMobile ? '' : 'flex items-center justify-between'}`}>
          <h1 className={`font-bold ${isMobile ? "text-lg" : "text-2xl"}`}>
            接口管理
          </h1>
        </div>

        {/* 搜索和筛选 */}
        <div className={`mb-4 shrink-0 ${isMobile ? "flex flex-col gap-2" : "flex gap-4"}`}>
          <Search
            placeholder="搜索接口编码、名称、路径"
            allowClear
            enterButton={<SearchOutlined />}
            size={isMobile ? "middle" : "large"}
            value={searchInputValue}
            onSearch={(value) => updateQueryParams({ q: value, page: 1 })}
            onChange={(e) => setSearchInputValue(e.target.value)}
            onPressEnter={(e) => {
              e.preventDefault();
              updateQueryParams({ q: searchInputValue, page: 1 });
            }}
            style={isMobile ? { width: "100%" } : { maxWidth: 300 }}
          />
          <div className={isMobile ? "flex gap-2" : "contents"}>
            <Select
              placeholder="模块"
              allowClear
              size={isMobile ? "middle" : "large"}
              value={urlState.moduleFilter || undefined}
              onChange={(value) => updateQueryParams({ module: value || "", page: 1 })}
              style={isMobile ? { width: "50%" } : { width: 140 }}
              options={modules.map((m) => ({
                label: MODULE_LABELS[m] || m,
                value: m,
              }))}
            />
            <Select
              placeholder="MCP 状态"
              allowClear
              size={isMobile ? "middle" : "large"}
              value={urlState.mcpFilter || undefined}
              onChange={(value) => updateQueryParams({ mcp_enabled: value || "", page: 1 })}
              style={isMobile ? { width: "50%" } : { width: 120 }}
              options={[
                { label: "已启用", value: "1" },
                { label: "已禁用", value: "0" },
              ]}
            />
          </div>
        </div>

        {/* 接口列表 */}
        <ResponsiveTable<ApiRegistryItem>
          columns={columns}
          dataSource={apis}
          rowKey="id"
          loading={loading}
          renderMobileCard={renderMobileCard}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: (total) => `共 ${total} 个接口`,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ["10", "20", "50"],
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

      {/* MCP 工具详情弹窗 */}
      <Modal
        title={`MCP 工具详情 - ${mcpDetailApi?.mcp_tool_name || ""}`}
        open={!!mcpDetailApi}
        onCancel={() => setMcpDetailApi(null)}
        footer={null}
        width={560}
        destroyOnHidden
      >
        {mcpDetailApi && (() => {
          let schema: { properties?: Record<string, { type?: string; description?: string }>; required?: string[] } | null = null;
          try {
            schema = mcpDetailApi.input_schema ? JSON.parse(mcpDetailApi.input_schema) : null;
          } catch { /* ignore */ }

          return (
            <div className="space-y-4">
              <div>
                <div className="text-gray-400 text-xs mb-1">工具名称</div>
                <code className="text-blue-500 font-mono">{mcpDetailApi.mcp_tool_name}</code>
              </div>
              {mcpDetailApi.description && (
                <div>
                  <div className="text-gray-400 text-xs mb-1">描述</div>
                  <div className="text-sm">{mcpDetailApi.description}</div>
                </div>
              )}
              <div>
                <div className="text-gray-400 text-xs mb-1">接口信息</div>
                <Space>
                  <Tag color={METHOD_COLORS[mcpDetailApi.api_method] || "default"}>
                    {mcpDetailApi.api_method}
                  </Tag>
                  <code className="text-xs text-gray-500 font-mono">{mcpDetailApi.api_path}</code>
                  {mcpDetailApi.permission_code && (
                    <Tag>{mcpDetailApi.permission_code}</Tag>
                  )}
                </Space>
              </div>
              {schema && schema.properties && (
                <div>
                  <div className="text-gray-400 text-xs mb-2">输入参数</div>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    {Object.entries(schema.properties).map(([key, prop]) => (
                      <div key={key} className="flex items-start gap-2 text-sm">
                        <code className="font-mono text-blue-500 shrink-0">{key}</code>
                        <Tag className="shrink-0 text-xs" color={prop.type === 'string' ? 'green' : prop.type === 'number' ? 'orange' : 'default'}>
                          {prop.type || 'any'}
                        </Tag>
                        <span className="text-gray-600">{prop.description || ''}</span>
                        {schema.required?.includes(key) && (
                          <Tag color="red" className="shrink-0 text-xs">必填</Tag>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {mcpDetailApi.cache_tags && (
                <div>
                  <div className="text-gray-400 text-xs mb-1">缓存标签</div>
                  <div className="flex flex-wrap gap-1">
                    {mcpDetailApi.cache_tags.split(',').filter(Boolean).map(tag => (
                      <Tag key={tag} className="font-mono text-xs">{tag}</Tag>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        title={`配置接口 - ${editingApi?.name || ""}`}
        open={isEditModalOpen}
        onOk={handleSaveEdit}
        onCancel={() => setIsEditModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={500}
        destroyOnHidden
        forceRender
        confirmLoading={editLoading}
      >
        <div>
          {editingApi && (
            <div className="text-gray-400 text-xs mb-4 space-y-1">
              <div>
                <span className="font-mono">{editingApi.api_method}</span>{" "}
                <span className="font-mono">{editingApi.api_path}</span>
              </div>
              {editingApi.description && (
                <div>{editingApi.description}</div>
              )}
            </div>
          )}

          <Form form={editForm} layout="vertical">
            <Form.Item
              label="MCP 工具暴露"
              name="mcp_enabled"
              valuePropName="checked"
              getValueFromEvent={(checked) => (checked ? true : false)}
              getValueProps={(value) => ({ checked: value })}
            >
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>

            <Form.Item label="MCP 工具名" name="mcp_tool_name">
              <Input placeholder="MCP 工具名称（如 create_article）" />
            </Form.Item>

            <Form.Item label="关联权限码" name="permission_code">
              <Select
                allowClear
                placeholder="选择关联的权限码"
                showSearch={{ optionFilterProp: "label" }}
                options={allPermissions.map((p) => ({
                  label: `${p.name} (${p.code})`,
                  value: p.code,
                }))}
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </>
  );
}

export default function ApiRegistryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div>加载中...</div>
        </div>
      }
    >
      <ApiRegistryPageContent />
    </Suspense>
  );
}
