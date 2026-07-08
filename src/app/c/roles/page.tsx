/**
 * 角色管理页面
 * 路由: /c/roles
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
  Switch,
  Card,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SettingOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import { useAuth } from "@/contexts/AuthContext";
import ResponsiveTable from "@/components/ResponsiveTable";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import PermissionTree from "@/components/PermissionTree";
import { USER_ROLE_ASSIGN } from "@/constants/permissions";
import {
  AdminActionButton,
  AdminPageHeader,
  AdminTableActions,
} from "@/components/admin/AdminPageHeader";

const { Search } = Input;

const { confirm } = Modal;

/**
 * 从 URL 查询参数中读取状态
 */
function useUrlState() {
  const searchParams = useSearchParams();

  return useMemo(() => ({
    searchText: searchParams.get('q') || '',
    current: parseInt(searchParams.get('page') || '1', 10),
    pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
  }), [searchParams]);
}

/**
 * 查询参数类型定义
 */
interface QueryParams {
  q?: string;
  page?: number;
  pageSize?: number;
}

/**
 * 更新 URL 查询参数
 */
function useUpdateUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback((updates: Partial<QueryParams>) => {
    const currentParams: QueryParams = {
      q: searchParams.get('q') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined,
      pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined,
    };

    const mergedParams: QueryParams = {
      ...currentParams,
      ...updates,
    };

    const params = new URLSearchParams();

    if (mergedParams.q && mergedParams.q.trim()) {
      params.set('q', mergedParams.q.trim());
    }

    if (mergedParams.page && mergedParams.page > 1) {
      params.set('page', mergedParams.page.toString());
    }

    if (mergedParams.pageSize && mergedParams.pageSize !== 20) {
      params.set('pageSize', mergedParams.pageSize.toString());
    }

    const newUrl = params.toString() ? `?${params.toString()}` : '';
    router.replace(`${pathname}${newUrl}`, { scroll: false });
  }, [router, pathname, searchParams]);
}

interface RolePermission {
  id: number;
  code: string;
  name: string;
  module: string;
  type: string;
  data_scope: string;
}

interface RoleItem {
  id: number;
  code: string;
  name: string;
  description: string | null;
  status: number;
  sort_order: number;
  user_count: number;
  permissions: RolePermission[];
  created_at: string;
  updated_at: string;
}

interface PermissionItem {
  id: number;
  code: string;
  name: string;
  module: string;
  type: string;
  description: string | null;
  status: number;
}

function RolesPageContent() {
  const { hasPermission } = useAuth();
  const { isMobile } = useBreakpoint();
  const urlState = useUrlState();
  const updateUrl = useUpdateUrl();

  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchInputValue, setSearchInputValue] = useState(urlState.searchText);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [form] = Form.useForm();

  // 权限管理相关状态
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [managingRole, setManagingRole] = useState<RoleItem | null>(null);
  const [allPermissions, setAllPermissions] = useState<PermissionItem[]>([]);
  const [selectedPermCodes, setSelectedPermCodes] = useState<string[]>([]);
  const [permDataScopes, setPermDataScopes] = useState<Record<string, string>>({});
  const [permLoading, setPermLoading] = useState(false);

  // 使用 useMemo 避免每次渲染都创建新对象
  const pagination = useMemo(() => ({
    current: urlState.current,
    pageSize: urlState.pageSize,
    total: total,
  }), [urlState, total]);

  /**
   * 当 URL 中的搜索关键词变化时，同步搜索框的值
   */
  useEffect(() => {
    setSearchInputValue(urlState.searchText);
  }, [urlState.searchText]);

  /**
   * 加载角色列表
   */
  const loadRoles = useCallback(async (pageNum?: number, pageSize?: number) => {
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

      const response = await axios.get("/api/admin/roles", { params });
      if (response.data.status) {
        const data = response.data.data;
        setRoles(data.record || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("加载角色列表失败:", error);
      message.error("加载角色列表失败");
    } finally {
      setLoading(false);
    }
  }, [urlState]);

  /**
   * 加载所有权限码
   */
  const loadAllPermissions = useCallback(async () => {
    try {
      const response = await axios.get("/api/admin/permissions");
      if (response.data.status) {
        setAllPermissions(response.data.data.list || []);
      }
    } catch (error) {
      console.error("加载权限码失败:", error);
    }
  }, []);

  useEffect(() => {
    loadAllPermissions();
  }, [loadAllPermissions]);

  /**
   * 统一的查询参数更新方法
   */
  const updateQueryParams = useCallback((updates: Partial<QueryParams>) => {
    updateUrl(updates);
  }, [updateUrl]);

  /**
   * 当 URL 状态变化时，重新加载数据
   */
  useEffect(() => {
    loadRoles(urlState.current, urlState.pageSize);
  }, [loadRoles, urlState]);

  /**
   * 创建角色
   */
  const handleCreate = () => {
    setEditingRole(null);
    form.resetFields();
    form.setFieldsValue({ status: 1, sort_order: 0 });
    setIsModalOpen(true);
  };

  /**
   * 编辑角色
   */
  const handleEdit = (role: RoleItem) => {
    setEditingRole(role);
    form.setFieldsValue({
      code: role.code,
      name: role.name,
      description: role.description,
      status: role.status,
      sort_order: role.sort_order,
    });
    setIsModalOpen(true);
  };

  /**
   * 删除角色
   */
  const handleDelete = (role: RoleItem) => {
    confirm({
      title: "确认删除",
      content: `确定要删除角色「${role.name}」吗？`,
      okText: "确定",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        try {
          const response = await axios.delete(`/api/admin/roles/${role.id}`);
          if (response.data.status) {
            message.success("删除成功");
            loadRoles();
          } else {
            message.error(response.data.message || "删除失败");
          }
        } catch (error: unknown) {
          if (axios.isAxiosError(error) && error.response?.data?.message) {
            message.error(error.response.data.message);
          } else {
            message.error("删除失败");
          }
        }
      },
    });
  };

  /**
   * 保存角色（创建或更新）
   */
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      if (editingRole) {
        const response = await axios.put(`/api/admin/roles/${editingRole.id}`, values);
        if (response.data.status) {
          message.success("更新成功");
          setIsModalOpen(false);
          loadRoles();
        } else {
          message.error(response.data.message || "更新失败");
        }
      } else {
        const response = await axios.post("/api/admin/roles", values);
        if (response.data.status) {
          message.success("创建成功");
          setIsModalOpen(false);
          loadRoles();
        } else {
          message.error(response.data.message || "创建失败");
        }
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        console.error("保存角色失败:", error);
        message.error("保存失败");
      }
    }
  };

  /**
   * 打开权限管理弹窗
   */
  const handleManagePermissions = async (role: RoleItem) => {
    setManagingRole(role);
    setIsPermModalOpen(true);
    setPermLoading(true);

    try {
      // 获取角色当前权限
      const response = await axios.get(`/api/admin/roles/${role.id}/permissions`);
      if (response.data.status) {
        const perms = response.data.data.permissions || [];

        setSelectedPermCodes(perms.map((p: RolePermission) => p.code));
        const scopes: Record<string, string> = {};
        perms.forEach((p: RolePermission) => {
          scopes[p.code] = p.data_scope;
        });
        setPermDataScopes(scopes);
      }
    } catch (error) {
      console.error("获取角色权限失败:", error);
      message.error("获取角色权限失败");
    } finally {
      setPermLoading(false);
    }
  };

  /**
   * 保存角色权限
   */
  const handleSavePermissions = async () => {
    if (!managingRole) return;

    try {
      const permissions = selectedPermCodes.map(code => ({
        code,
        data_scope: permDataScopes[code] || "self",
      }));

      const response = await axios.put(`/api/admin/roles/${managingRole.id}/permissions`, {
        permissions,
      });

      if (response.data.status) {
        message.success("权限更新成功");
        setIsPermModalOpen(false);
        loadRoles();
      } else {
        message.error(response.data.message || "更新失败");
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error("保存权限失败");
      }
    }
  };

  /**
   * 表格列定义
   */
  const columns: TableColumnsType<RoleItem> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 60,
    },
    {
      title: "角色编码",
      dataIndex: "code",
      key: "code",
      width: 120,
      render: (code: string) => <Tag>{code}</Tag>,
    },
    {
      title: "角色名称",
      dataIndex: "name",
      key: "name",
      width: 120,
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (desc: string | null) => desc || "-",
    },
    {
      title: "权限数",
      key: "perm_count",
      width: 80,
      render: (_: unknown, record: RoleItem) => record.permissions.length,
    },
    {
      title: "用户数",
      dataIndex: "user_count",
      key: "user_count",
      width: 80,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 80,
      render: (status: number) => (
        <Tag color={status === 1 ? "success" : "default"}>
          {status === 1 ? "启用" : "禁用"}
        </Tag>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (date: string) => (date ? dayjs(date).format("YYYY-MM-DD HH:mm") : "-"),
    },
    {
      title: "操作",
      key: "action",
      width: 220,
      fixed: "right" as const,
      render: (_: unknown, record: RoleItem) => (
        <AdminTableActions>
          <AdminActionButton
            icon={<SettingOutlined />}
            onClick={() => handleManagePermissions(record)}
            disabled={!hasPermission(USER_ROLE_ASSIGN)}
          >
            权限
          </AdminActionButton>
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
            disabled={["admin", "user"].includes(record.code)}
          >
            删除
          </AdminActionButton>
        </AdminTableActions>
      ),
    },
  ];

  /**
   * 渲染移动端角色卡片
   */
  const renderMobileCard = (record: RoleItem) => (
    <Card size="small" className="mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-base">{record.name}</span>
        <Space>
          <Tag>{record.code}</Tag>
          <Tag color={record.status === 1 ? "success" : "default"}>
            {record.status === 1 ? "启用" : "禁用"}
          </Tag>
        </Space>
      </div>
      <div className="text-gray-500 text-sm mb-2">
        {record.description || "暂无描述"} · 权限 {record.permissions.length} 个 · 用户 {record.user_count} 个
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-xs">
          {record.created_at ? dayjs(record.created_at).format("YYYY-MM-DD") : "-"}
        </span>
        <AdminTableActions>
          <AdminActionButton
            icon={<SettingOutlined />}
            onClick={() => handleManagePermissions(record)}
            disabled={!hasPermission(USER_ROLE_ASSIGN)}
          >
            权限
          </AdminActionButton>
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
            disabled={["admin", "user"].includes(record.code)}
          >
            删除
          </AdminActionButton>
        </AdminTableActions>
      </div>
    </Card>
  );

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* 标题栏 */}
        <AdminPageHeader
          title="角色管理"
          extra={
          <Button variant="solid" color="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            size="small"
          >
            {isMobile ? "新建" : "创建角色"}
          </Button>
          }
        />

        {/* 搜索 */}
        <div className="mb-4 shrink-0">
          <Search
            placeholder="搜索角色编码、名称或描述"
            allowClear
            enterButton={<SearchOutlined />}
            size="middle"
            value={searchInputValue}
            onSearch={(value) => updateQueryParams({ q: value, page: 1 })}
            onChange={(e) => setSearchInputValue(e.target.value)}
            onPressEnter={(e) => {
              e.preventDefault();
              updateQueryParams({ q: searchInputValue, page: 1 });
            }}
            style={isMobile ? { width: "100%" } : { maxWidth: 400 }}
          />
        </div>

        {/* 角色列表 */}
        <ResponsiveTable<RoleItem>
          columns={columns}
          dataSource={roles}
          rowKey="id"
          loading={loading}
          renderMobileCard={renderMobileCard}
          scroll={{ x: 900 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: (total) => `共 ${total} 个角色`,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          onChange={(paginationConfig) => {
            updateQueryParams({
              page: paginationConfig.current || 1,
              pageSize: paginationConfig.pageSize || 20,
            });
          }}
        />
      </div>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingRole ? "编辑角色" : "创建角色"}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={500}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="角色编码"
            name="code"
            rules={[
              { required: true, message: "请输入角色编码" },
              { pattern: /^[a-z_]+$/, message: "仅允许小写字母和下划线" },
            ]}
          >
            <Input
              placeholder="如 editor、viewer"
              maxLength={50}
              disabled={!!editingRole}
            />
          </Form.Item>

          <Form.Item
            label="角色名称"
            name="name"
            rules={[{ required: true, message: "请输入角色名称" }]}
          >
            <Input placeholder="如 编辑者、访客" maxLength={50} />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="角色描述" maxLength={255} rows={3} />
          </Form.Item>

          <Form.Item label="排序" name="sort_order">
            <Input type="number" placeholder="0" />
          </Form.Item>

          <Form.Item
            label="状态"
            name="status"
            valuePropName="checked"
            getValueFromEvent={(checked) => (checked ? 1 : 0)}
            getValueProps={(value) => ({ checked: value === 1 })}
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 权限管理弹窗 */}
      <Modal
        title={`管理权限 - ${managingRole?.name || ""}`}
        open={isPermModalOpen}
        onOk={handleSavePermissions}
        onCancel={() => setIsPermModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={600}
        destroyOnHidden
        confirmLoading={permLoading}
      >
        <div className="text-gray-500 text-xs mb-2">
          勾选权限后可在右侧设置数据权限范围
        </div>
        <PermissionTree
          allPermissions={allPermissions}
          selectedKeys={selectedPermCodes}
          dataScopes={permDataScopes}
          onCheckedChange={setSelectedPermCodes}
          onDataScopeChange={(code, scope) =>
            setPermDataScopes(prev => ({ ...prev, [code]: scope }))
          }
        />
      </Modal>
    </div>
  );
}

export default function RolesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div>加载中...</div>
        </div>
      }
    >
      <RolesPageContent />
    </Suspense>
  );
}
