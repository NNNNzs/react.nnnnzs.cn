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
  Checkbox,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
  LockOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import { useAuth } from "@/contexts/AuthContext";
import { USER_MANAGE } from "@/constants/permissions";
import type { QueryUserCondition, UserInfo } from "@/dto/user.dto";
import { UserRole, RoleDisplayNames, getRoleOptions } from "@/types/role";
import ResponsiveTable from "@/components/ResponsiveTable";
import { useBreakpoint } from "@/hooks/useBreakpoint";

const { Search } = Input;
const { confirm } = Modal;

/**
 * 从 URL 查询参数中读取状态
 */
function useUrlState() {
  const searchParams = useSearchParams();

  return {
    searchText: searchParams.get("q") || "",
    roleFilter: searchParams.get("role") || "all",
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
  role?: string;
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
        role: searchParams.get("role") || undefined,
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

      if (mergedParams.role && mergedParams.role !== "all") {
        params.set("role", mergedParams.role);
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

  // RBAC 角色分配相关状态
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleAssignUser, setRoleAssignUser] = useState<UserInfo | null>(null);
  const [allRoles, setAllRoles] = useState<{ id: number; code: string; name: string }[]>([]);
  const [userRoleIds, setUserRoleIds] = useState<number[]>([]);
  const [roleLoading, setRoleLoading] = useState(false);

  const { isMobile } = useBreakpoint();

  const roleFilter = urlState.roleFilter;
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
    if (user && !hasPermission(USER_MANAGE)) {
      message.error("无权限访问用户管理");
      router.push("/c/post");
    }
  }, [user, router]);

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
          ...(urlState.roleFilter &&
            urlState.roleFilter !== "all" && {
            role: urlState.roleFilter,
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
      role: targetUser.role,
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
      role: UserRole.USER,
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
    Modal.confirm({
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

  /**
   * 打开角色分配弹窗
   */
  const handleAssignRoles = async (targetUser: UserInfo) => {
    setRoleAssignUser(targetUser);
    setIsRoleModalOpen(true);
    setRoleLoading(true);

    try {
      // 加载角色列表（如果还没加载）
      if (allRoles.length === 0) {
        await loadAllRoles();
      }
      // 获取用户当前角色
      const response = await axios.get(`/api/admin/users/${targetUser.id}/roles`);
      if (response.data.status) {
        const roles = response.data.data.roles || [];
        setUserRoleIds(roles.map((r: { id: number }) => r.id));
      }
    } catch (error) {
      console.error("获取用户角色失败:", error);
      message.error("获取用户角色失败");
    } finally {
      setRoleLoading(false);
    }
  };

  /**
   * 保存用户角色
   */
  const handleSaveRoles = async () => {
    if (!roleAssignUser) return;

    try {
      const response = await axios.put(`/api/admin/users/${roleAssignUser.id}/roles`, {
        role_ids: userRoleIds,
      });
      if (response.data.status) {
        message.success("用户角色更新成功");
        setIsRoleModalOpen(false);
        loadUsers(urlState.current, urlState.pageSize);
      } else {
        message.error(response.data.message || "更新失败");
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error("保存角色失败");
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
    if (user && hasPermission(USER_MANAGE)) {
      loadUsers(urlState.current, urlState.pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    urlState.current,
    urlState.pageSize,
    urlState.roleFilter,
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
      dataIndex: "role",
      key: "role",
      width: 120,
      render: (role: string | null) => {
        const roleValue = (role || UserRole.GUEST) as UserRole;
        const colorMap = {
          [UserRole.ADMIN]: "red",
          [UserRole.USER]: "blue",
          [UserRole.GUEST]: "default",
        };
        return (
          <Tag color={colorMap[roleValue]}>
            {RoleDisplayNames[roleValue] || role}
          </Tag>
        );
      },
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
            icon={<SafetyOutlined />}
            onClick={() => handleAssignRoles(record)}
          >
            角色
          </Button>
          <Button
            type="link"
            icon={<LockOutlined />}
            onClick={() => handleResetPassword(record)}
          >
            重置密码
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            disabled={record.role === UserRole.ADMIN}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  /**
   * 角色颜色映射
   */
  const roleColorMap = {
    [UserRole.ADMIN]: "red",
    [UserRole.USER]: "blue",
    [UserRole.GUEST]: "default",
  };

  /**
   * 渲染移动端用户卡片
   */
  const renderMobileCard = (record: UserInfo) => {
    const roleValue = (record.role || UserRole.GUEST) as UserRole;
    return (
      <Card size="small" className="mb-2">
        {/* 顶部：昵称 + 角色 + 状态 */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-base">{record.nickname}</span>
          <Space>
            <Tag color={roleColorMap[roleValue]}>
              {RoleDisplayNames[roleValue] || record.role}
            </Tag>
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
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              icon={<SafetyOutlined />}
              onClick={() => handleAssignRoles(record)}
            >
              角色
            </Button>
            <Button
              type="link"
              size="small"
              icon={<LockOutlined />}
              onClick={() => handleResetPassword(record)}
            >
              重置密码
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
              disabled={record.role === UserRole.ADMIN}
            >
              删除
            </Button>
          </Space>
        </div>
      </Card>
    );
  };

  return (
    <>
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        {/* 标题栏 */}
        <div className={`mb-4 flex items-center justify-between shrink-0 ${isMobile ? 'gap-2' : ''}`}>
          <h1 className={`font-bold ${isMobile ? "text-lg" : "text-2xl"}`}>
            用户管理
          </h1>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            size={isMobile ? "middle" : "large"}
          >
            {isMobile ? "新建" : "创建新用户"}
          </Button>
        </div>

        {/* 搜索和筛选 */}
        <div className={`mb-4 shrink-0 ${isMobile ? "flex flex-col gap-2" : "flex gap-4"}`}>
          <Search
            placeholder="搜索账号、昵称或邮箱"
            allowClear
            enterButton={<SearchOutlined />}
            size={isMobile ? "middle" : "large"}
            value={searchInputValue}
            onSearch={(value) => updateQueryParams({ q: value, page: 1 })}
            onChange={(e) => setSearchInputValue(e.target.value)}
            style={isMobile ? { width: "100%" } : { maxWidth: 400 }}
          />
          <div className={isMobile ? "flex gap-2" : "contents"}>
            <Select
              placeholder="角色筛选"
              allowClear
              size={isMobile ? "middle" : "large"}
              style={isMobile ? { width: "50%" } : { width: 140 }}
              value={roleFilter === "all" ? undefined : roleFilter}
              onChange={(value) =>
                updateQueryParams({ role: value || "all", page: 1 })
              }
              options={[
                { label: "全部角色", value: "all" },
                ...getRoleOptions(),
              ]}
            />
            <Select
              placeholder="状态筛选"
              allowClear
              size={isMobile ? "middle" : "large"}
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
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            role: UserRole.USER,
            status: 1,
          }}
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
              disabled={!!editingUser}
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
              <Input.Password placeholder="请输入密码" maxLength={32} />
            </Form.Item>
          )}

          <Form.Item
            label="昵称"
            name="nickname"
            rules={[{ required: true, message: "请输入昵称" }]}
          >
            <Input placeholder="请输入昵称" maxLength={16} />
          </Form.Item>

          <Form.Item
            label="角色"
            name="role"
            rules={[{ required: true, message: "请选择角色" }]}
          >
            <Select placeholder="请选择角色" options={getRoleOptions()} />
          </Form.Item>

          <Form.Item label="邮箱" name="mail">
            <Input placeholder="请输入邮箱" maxLength={30} type="email" />
          </Form.Item>

          <Form.Item label="手机" name="phone">
            <Input placeholder="请输入手机号" maxLength={11} />
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

      {/* RBAC 角色分配弹窗 */}
      <Modal
        title={`分配角色 - ${roleAssignUser?.nickname || ""}`}
        open={isRoleModalOpen}
        onOk={handleSaveRoles}
        onCancel={() => setIsRoleModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={500}
        destroyOnHidden
        confirmLoading={roleLoading}
      >
        {roleAssignUser && (
          <div>
            <div className="mb-4 text-gray-500">
              为用户「{roleAssignUser.nickname}」分配角色：
            </div>
            <Checkbox.Group
              value={userRoleIds}
              onChange={(checked) => setUserRoleIds(checked as number[])}
              className="flex flex-col gap-3"
            >
              {allRoles.map(role => (
                <Checkbox key={role.id} value={role.id}>
                  <div>
                    <span className="font-medium">{role.name}</span>
                    <Tag className="ml-2">{role.code}</Tag>
                  </div>
                </Checkbox>
              ))}
            </Checkbox.Group>
            {allRoles.length === 0 && !roleLoading && (
              <div className="text-gray-400 text-center py-4">
                暂无可用角色，请先在角色管理中创建角色
              </div>
            )}
          </div>
        )}
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
