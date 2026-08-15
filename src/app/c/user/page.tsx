/**
 * 用户管理页面
 * 路由: /c/user
 */

"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Space, Tag, Modal, Form, Select, Switch, Card,  } from "antd";
import { message, modal } from "@/components/AntdAppFeedbackBridge";
import type { TableColumnsType } from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
  LockOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import { useAuth } from "@/contexts/AuthContext";
import { USER_MANAGE, USER_ROLE_ASSIGN, USER_VIEW } from "@/constants/permissions";
import type { QueryUserCondition, UserInfo } from "@/dto/user.dto";
import { DEFAULT_USER_ROLE_CODE } from "@/constants/roles";
import ResponsiveTable from "@/components/ResponsiveTable";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import {
  AdminActionButton,
  AdminPageHeader,
  AdminTableActions,
} from "@/components/admin/AdminPageHeader";

const { Search } = Input;
const confirm = (...args: Parameters<typeof modal.confirm>) => modal.confirm(...args);

/**
 * 从 URL 查询参数中读取状态
 */
function useUrlState() {
  const searchParams = useSearchParams();

  return useMemo(() => ({
    searchText: searchParams.get("q") || "",
    roleIdFilter: searchParams.get("role_id") || "all",
    statusFilter: searchParams.get("status") || "all",
    current: parseInt(searchParams.get("page") || "1", 10),
    pageSize: parseInt(searchParams.get("pageSize") || "20", 10),
  }), [searchParams]);
}

/**
 * 查询参数类型定义
 */
interface QueryParams {
  q?: string;
  role_id?: string;
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
        role_id: searchParams.get("role_id") || undefined,
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

      if (mergedParams.role_id && mergedParams.role_id !== "all") {
        params.set("role_id", mergedParams.role_id);
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
      router.replace(`/c/user${newUrl}`, { scroll: false });
    },
    [router, searchParams]
  );
}

function UserPageContent() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const urlState = useUrlState();
  const updateUrl = useUpdateUrl();

  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchInputValue, setSearchInputValue] = useState(urlState.searchText);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [form] = Form.useForm();

  const [allRoles, setAllRoles] = useState<Array<{ id: number; code: string; name: string; status: number }>>([]);

  const { isMobile } = useBreakpoint();
  const canManageUsers = hasPermission(USER_MANAGE);
  const canAssignRoles = hasPermission(USER_ROLE_ASSIGN);

  const roleIdFilter = urlState.roleIdFilter;
  const statusFilter = urlState.statusFilter;

  const pagination = useMemo(
    () => ({
      current: urlState.current,
      pageSize: urlState.pageSize,
      total: total,
    }),
    [urlState, total]
  );

  /**
   * 检查权限
   */
  useEffect(() => {
    if (user && !hasPermission(USER_VIEW)) {
      message.error("无权限访问用户管理");
      router.push("/c/post");
    }
  }, [user, hasPermission, router]);

  /**
   * 当 URL 中的搜索关键词变化时，同步搜索框的值
   */
  useEffect(() => {
    setSearchInputValue(urlState.searchText);
  }, [urlState.searchText]);

  /**
   * 加载用户列表
   */
  const loadUsers = useCallback(
    async (pageNum?: number, pageSize?: number) => {
      try {
        setLoading(true);

        const currentPage = pageNum ?? urlState.current;
        const currentPageSize = pageSize ?? urlState.pageSize;

        const params: QueryUserCondition = {
          pageNum: currentPage,
          pageSize: currentPageSize,
          ...(urlState.searchText && { query: urlState.searchText }),
          ...(urlState.roleIdFilter &&
            urlState.roleIdFilter !== "all" && {
            role_id: Number(urlState.roleIdFilter),
          }),
          ...(urlState.statusFilter &&
            urlState.statusFilter !== "all" && {
            status: Number(urlState.statusFilter),
          }),
        };

        const response = await axios.get("/api/user/list", { params });

        if (response.data.status) {
          const data = response.data.data;
          setUsers(data.record || []);
          setTotal(data.total || 0);
        }
      } catch (error) {
        console.error("加载用户失败:", error);
        message.error("加载用户失败");
      } finally {
        setLoading(false);
      }
    },
    [urlState]
  );

  /**
   * 删除用户
   */
  const handleDelete = (targetUser: UserInfo) => {
    confirm({
      title: "确认删除",
      content: `确定要删除用户《${targetUser.nickname}》吗？`,
      okText: "确定",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        try {
          const response = await axios.delete(`/api/user/${targetUser.id}`);
          if (response.data.status) {
            message.success("删除成功");
            loadUsers(urlState.current, urlState.pageSize);
          } else {
            message.error(response.data.message || "删除失败");
          }
        } catch (error) {
          console.error("删除用户失败:", error);
          message.error("删除失败");
        }
      },
    });
  };

  /**
   * 编辑用户
   */
  const handleEdit = (targetUser: UserInfo) => {
    setEditingUser(targetUser);
    form.setFieldsValue({
      account: targetUser.account,
      nickname: targetUser.nickname,
      role_ids: targetUser.roles.map((role) => role.id),
      mail: targetUser.mail,
      phone: targetUser.phone,
      status: targetUser.status,
    });
    setIsModalOpen(true);
  };

  /**
   * 创建新用户
   */
  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({
      role_ids: allRoles.filter((role) => role.status === 1 && role.code === DEFAULT_USER_ROLE_CODE).map((role) => role.id),
      status: 1,
    });
    setIsModalOpen(true);
  };

  /**
   * 保存用户（创建或更新）
   */
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (!hasPermission(USER_ROLE_ASSIGN)) delete values.role_ids;
      if (editingUser && !canManageUsers) {
        Object.keys(values).forEach((key) => {
          if (key !== 'role_ids') delete values[key];
        });
      }

      if (editingUser) {
        // 更新
        const response = await axios.put(
          `/api/user/${editingUser.id}`,
          values
        );
        if (response.data.status) {
          message.success("更新成功");
          setIsModalOpen(false);
          loadUsers(urlState.current, urlState.pageSize);
        } else {
          message.error(response.data.message || "更新失败");
        }
      } else {
        // 创建
        const response = await axios.post("/api/user/create", values);
        if (response.data.status) {
          message.success("创建成功");
          setIsModalOpen(false);
          loadUsers(urlState.current, urlState.pageSize);
        } else {
          message.error(response.data.message || "创建失败");
        }
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        console.error("保存用户失败:", error);
        message.error("保存失败");
      }
    }
  };

  /**
   * 重置密码
   */
  const handleResetPassword = (targetUser: UserInfo) => {
    modal.confirm({
      title: "重置密码",
      content: (
        <div>
          <p>确定要重置用户《{targetUser.nickname}》的密码吗？</p>
          <p className="text-red-500">新密码将设置为: 123456</p>
        </div>
      ),
      okText: "确定",
      cancelText: "取消",
      onOk: async () => {
        try {
          const response = await axios.put(`/api/user/${targetUser.id}`, {
            password: "123456",
          });
          if (response.data.status) {
            message.success("密码重置成功");
          } else {
            message.error(response.data.message || "重置密码失败");
          }
        } catch (error) {
          console.error("重置密码失败:", error);
          message.error("重置密码失败");
        }
      },
    });
  };

  /**
   * 加载所有角色列表
   */
  const loadAllRoles = useCallback(async () => {
    try {
      const response = await axios.get("/api/admin/roles", {
        params: { pageNum: 1, pageSize: 100 },
      });
      if (response.data.status) {
        setAllRoles(response.data.data.record || []);
      }
    } catch (error) {
      console.error("加载角色列表失败:", error);
    }
  }, []);

  useEffect(() => {
    if (user && hasPermission(USER_VIEW)) void loadAllRoles();
  }, [user, hasPermission, loadAllRoles]);

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
    if (user && hasPermission(USER_VIEW)) {
      loadUsers(urlState.current, urlState.pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    urlState.current,
    urlState.pageSize,
    urlState.roleIdFilter,
    urlState.statusFilter,
    urlState.searchText,
  ]);

  /**
   * 表格列定义
   */
  const columns: TableColumnsType<UserInfo> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 80,
    },
    {
      title: "账号",
      dataIndex: "account",
      key: "account",
      width: 150,
    },
    {
      title: "昵称",
      dataIndex: "nickname",
      key: "nickname",
      width: 150,
    },
    {
      title: "角色",
      dataIndex: "roles",
      key: "roles",
      width: 200,
      render: (roles: UserInfo["roles"]) => roles.map((role) => (
        <Tag key={role.id}>{role.name}</Tag>
      )),
    },
    {
      title: "邮箱",
      dataIndex: "mail",
      key: "mail",
      ellipsis: true,
      render: (mail: string | null) => mail || "-",
    },
    {
      title: "手机",
      dataIndex: "phone",
      key: "phone",
      width: 130,
      render: (phone: string | null) => phone || "-",
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
      title: "注册时间",
      dataIndex: "registered_time",
      key: "registered_time",
      width: 180,
      render: (date: string | Date | null) =>
        date ? dayjs(date).format("YYYY-MM-DD HH:mm") : "-",
    },
    {
      title: "操作",
      key: "action",
      width: 300,
      fixed: "right" as const,
      render: (_: unknown, record: UserInfo) => (
        <AdminTableActions>
          {(canManageUsers || canAssignRoles) && <AdminActionButton
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </AdminActionButton>}
          {canManageUsers && <AdminActionButton
            icon={<LockOutlined />}
            onClick={() => handleResetPassword(record)}
          >
            重置密码
          </AdminActionButton>}
          {canManageUsers && <AdminActionButton
            color="danger"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </AdminActionButton>}
        </AdminTableActions>
      ),
    },
  ];

  /**
   * 渲染移动端用户卡片
   */
  const renderMobileCard = (record: UserInfo) => {
    return (
      <Card size="small" className="mb-2">
        {/* 顶部：昵称 + 角色 + 状态 */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-base">{record.nickname}</span>
          <Space>
            {record.roles.map((role) => <Tag key={role.id}>{role.name}</Tag>)}
            <Tag color={record.status === 1 ? "success" : "default"}>
              {record.status === 1 ? "启用" : "禁用"}
            </Tag>
          </Space>
        </div>

        {/* 中间：账号 · 邮箱 · 手机号 */}
        <div className="text-gray-500 text-sm mb-2">
          {[record.account, record.mail || null, record.phone || null]
            .filter(Boolean)
            .join(" · ")}
        </div>

        {/* 底部：注册日期 + 操作按钮 */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">
            {record.registered_time
              ? dayjs(record.registered_time).format("YYYY-MM-DD")
              : "-"}
          </span>
          <AdminTableActions>
            {(canManageUsers || canAssignRoles) && <AdminActionButton
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </AdminActionButton>}
            {canManageUsers && <AdminActionButton
              icon={<LockOutlined />}
              onClick={() => handleResetPassword(record)}
            >
              重置密码
            </AdminActionButton>}
            {canManageUsers && <AdminActionButton
              color="danger"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            >
              删除
            </AdminActionButton>}
          </AdminTableActions>
        </div>
      </Card>
    );
  };

  return (
    <>
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        {/* 标题栏 */}
        <AdminPageHeader
          title="用户管理"
          extra={
          canManageUsers ? <Button variant="solid" color="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            size="small"
          >
            {isMobile ? "新建" : "创建新用户"}
          </Button> : null
          }
        />

        {/* 搜索和筛选 */}
        <div className={`mb-4 shrink-0 ${isMobile ? "flex flex-col gap-2" : "flex gap-4"}`}>
          <Search
            placeholder="搜索账号、昵称或邮箱"
            allowClear
            enterButton={<SearchOutlined />}
            size="middle"
            value={searchInputValue}
            onSearch={(value) => updateQueryParams({ q: value, page: 1 })}
            onChange={(e) => setSearchInputValue(e.target.value)}
            style={isMobile ? { width: "100%" } : { maxWidth: 400 }}
          />
          <div className={isMobile ? "flex gap-2" : "contents"}>
            <Select
              placeholder="角色筛选"
              allowClear
              size="middle"
              style={isMobile ? { width: "50%" } : { width: 140 }}
              value={roleIdFilter === "all" ? undefined : roleIdFilter}
              onChange={(value) =>
                updateQueryParams({ role_id: value ? String(value) : "all", page: 1 })
              }
              options={[
                { label: "全部角色", value: "all" },
                ...allRoles.map((role) => ({ label: role.name, value: String(role.id) })),
              ]}
            />
            <Select
              placeholder="状态筛选"
              allowClear
              size="middle"
              style={isMobile ? { width: "50%" } : { width: 120 }}
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
        </div>

        {/* 用户列表 */}
        <ResponsiveTable<UserInfo>
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          renderMobileCard={renderMobileCard}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: (total) => `共 ${total} 个用户`,
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
        title={editingUser ? "编辑用户" : "创建用户"}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={600}
        styles={{
          header: { zIndex: 1001 },
          mask: { backgroundColor: "rgba(0, 0, 0, 0.45)" },
          body: { zIndex: 1000 }
        }}
        destroyOnHidden
        forceRender
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ status: 1 }}
        >
          <Form.Item
            label="账号"
            name="account"
            rules={[
              { required: true, message: "请输入账号" },
              { min: 3, message: "账号至少3个字符" },
            ]}
          >
            <Input
              placeholder="请输入账号"
              maxLength={16}
              disabled={!!editingUser || !canManageUsers}
              autoComplete="username"
            />
          </Form.Item>

          {!editingUser && (
            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: "请输入密码" },
                { min: 6, message: "密码至少6个字符" },
              ]}
            >
              <Input.Password placeholder="请输入密码" maxLength={32} autoComplete="new-password" disabled={!canManageUsers} />
            </Form.Item>
          )}

          <Form.Item
            label="昵称"
            name="nickname"
            rules={[{ required: true, message: "请输入昵称" }]}
          >
            <Input placeholder="请输入昵称" maxLength={16} autoComplete="nickname" disabled={!canManageUsers} />
          </Form.Item>

          {canAssignRoles ? <Form.Item
            label="角色"
            name="role_ids"
            rules={[{ required: true, message: "请选择角色" }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择角色"
              options={allRoles.filter((role) => role.status === 1).map((role) => ({
                label: `${role.name}（${role.code}）`,
                value: role.id,
              }))}
            />
          </Form.Item> : editingUser ? (
            <Form.Item label="角色">
              <Space wrap>{editingUser.roles.map((role) => <Tag key={role.id}>{role.name}</Tag>)}</Space>
            </Form.Item>
          ) : (
            <Form.Item label="角色"><span className="text-gray-500">将自动分配普通用户角色</span></Form.Item>
          )}

          <Form.Item label="邮箱" name="mail">
            <Input placeholder="请输入邮箱" maxLength={30} type="email" autoComplete="email" disabled={!canManageUsers} />
          </Form.Item>

          <Form.Item label="手机" name="phone">
            <Input placeholder="请输入手机号" maxLength={11} autoComplete="tel" disabled={!canManageUsers} />
          </Form.Item>

          <Form.Item
            label="状态"
            name="status"
            valuePropName="checked"
            getValueFromEvent={(checked) => (checked ? 1 : 0)}
            getValueProps={(value) => ({ checked: value === 1 })}
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" disabled={!canManageUsers} />
          </Form.Item>

          {editingUser && (
            <>
              <Form.Item label="注册时间">
                <Input
                  value={
                    editingUser.registered_time
                      ? dayjs(editingUser.registered_time).format(
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

    </>
  );
}

/**
 * 默认导出组件，使用 Suspense 包裹以支持 useSearchParams
 */
export default function UserPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div>加载中...</div>
        </div>
      }
    >
      <UserPageContent />
    </Suspense>
  );
}
