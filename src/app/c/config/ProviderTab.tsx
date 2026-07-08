/**
 * AI 供应商管理 Tab
 * 列表 + 新建/编辑弹窗 + 一键拉取模型
 */

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Button,
  Input,
  Tag,
  Card,
  message,
  Modal,
  Form,
  Space,
  Popconfirm,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  CloudSyncOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import ResponsiveTable from "@/components/ResponsiveTable";
import {
  AdminActionButton,
  AdminTableActions,
} from "@/components/admin/AdminPageHeader";

const { TextArea } = Input;

interface ProviderRecord {
  id: number;
  name: string;
  base_url: string;
  api_key: string;
  models: string[];
  status: number;
  remark: string | null;
  created_at: string;
  updated_at: string;
  bindingCount: number;
}

function ProviderTab() {
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderRecord | null>(null);
  const [modelInput, setModelInput] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelFilter, setModelFilter] = useState("");

  const filteredModels = useMemo(
    () =>
      modelFilter.trim()
        ? models.filter((m) => m.toLowerCase().includes(modelFilter.trim().toLowerCase()))
        : models,
    [models, modelFilter],
  );
  const [fetchingModels, setFetchingModels] = useState(false);
  const [form] = Form.useForm();
  const { isMobile } = useBreakpoint();

  const loadProviders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/config/ai/providers");
      if (res.data.status) {
        setProviders(res.data.data || []);
      }
    } catch (err) {
      console.error("加载供应商失败:", err);
      message.error("加载供应商失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handleCreate = () => {
    setEditing(null);
    form.resetFields();
    setModels([]);
    setModelInput("");
    setIsModalOpen(true);
  };

  const handleEdit = (record: ProviderRecord) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      base_url: record.base_url,
      api_key: record.api_key,
      status: record.status,
      remark: record.remark,
    });
    setModels(record.models);
    setModelInput("");
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await axios.delete(`/api/config/ai/providers/${id}`);
      if (res.data.status) {
        message.success("供应商已删除");
        loadProviders();
      } else {
        message.error(res.data.message || "删除失败");
      }
    } catch (err) {
      console.error("删除供应商失败:", err);
      message.error("删除失败");
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        models,
      };

      if (editing) {
        const res = await axios.put(`/api/config/ai/providers/${editing.id}`, payload);
        if (res.data.status) {
          message.success("供应商已更新");
          setIsModalOpen(false);
          loadProviders();
        } else {
          message.error(res.data.message || "更新失败");
        }
      } else {
        const res = await axios.post("/api/config/ai/providers", payload);
        if (res.data.status) {
          message.success("供应商已创建");
          setIsModalOpen(false);
          loadProviders();
        } else {
          message.error(res.data.message || "创建失败");
        }
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        message.error(err.response.data.message);
      } else {
        console.error("保存供应商失败:", err);
        message.error("保存失败");
      }
    }
  };

  const handleFetchModels = async () => {
    if (!editing) return;
    setFetchingModels(true);
    try {
      const res = await axios.post(`/api/config/ai/providers/${editing.id}/fetch-models`);
      if (res.data.status) {
        const data = res.data.data;
        if (data?.ok && data.models) {
          setModels(data.models);
          message.success(`已拉取 ${data.models.length} 个模型`);
        } else {
          message.warning(data?.error || "拉取失败，请手动添加模型");
        }
      } else {
        message.warning(res.data.message || "拉取失败，请手动添加模型");
      }
    } catch {
      message.error("拉取模型列表失败");
    } finally {
      setFetchingModels(false);
    }
  };

  const addModel = () => {
    const trimmed = modelInput.trim();
    if (!trimmed) return;
    if (models.includes(trimmed)) {
      message.warning("模型已存在");
      return;
    }
    setModels([...models, trimmed]);
    setModelInput("");
  };

  const removeModel = (m: string) => {
    setModels(models.filter((item) => item !== m));
  };

  const columns: TableColumnsType<ProviderRecord> = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
    },
    {
      title: "Base URL",
      dataIndex: "base_url",
      key: "base_url",
      ellipsis: true,
      render: (url: string) => (
        <span className="font-mono text-sm truncate block" title={url}>
          {url}
        </span>
      ),
    },
    {
      title: "模型数",
      dataIndex: "models",
      key: "models",
      width: 80,
      render: (m: string[]) => <Tag>{m?.length ?? 0}</Tag>,
    },
    {
      title: "绑定数",
      dataIndex: "bindingCount",
      key: "bindingCount",
      width: 80,
      render: (count: number) => <Tag>{count}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 80,
      render: (status: number) => (
        <Tag color={status === 1 ? "success" : "default"}>
          {status === 1 ? "启用" : "停用"}
        </Tag>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      key: "updated_at",
      width: 160,
      render: (date: string) =>
        date ? dayjs(date).format("YYYY-MM-DD HH:mm") : "-",
    },
    {
      title: "操作",
      key: "action",
      width: isMobile ? 120 : 180,
      fixed: "right" as const,
      render: (_: unknown, record: ProviderRecord) => (
        <AdminTableActions>
          <AdminActionButton icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </AdminActionButton>
          <AdminActionButton
            color="danger"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </AdminActionButton>
        </AdminTableActions>
      ),
    },
  ];

  const renderMobileCard = (record: ProviderRecord) => (
    <Card size="small" className="mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium truncate flex-1 mr-2">{record.name}</span>
        <Tag color={record.status === 1 ? "success" : "default"}>
          {record.status === 1 ? "启用" : "停用"}
        </Tag>
      </div>
      <div className="text-xs text-gray-400 space-y-0.5 mb-2">
        <div className="font-mono truncate">{record.base_url}</div>
        <div>模型: {record.models?.length ?? 0} · 绑定: {record.bindingCount}</div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {record.updated_at ? dayjs(record.updated_at).format("YYYY-MM-DD HH:mm") : "-"}
        </span>
        <AdminTableActions>
          <AdminActionButton icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </AdminActionButton>
          <AdminActionButton
            color="danger"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </AdminActionButton>
        </AdminTableActions>
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 shrink-0 flex items-center justify-between">
        <span className="text-sm text-gray-500">
          管理供应商的 Base URL、API Key 和可用模型
        </span>
        <Button
          variant="solid"
          color="primary"
          icon={<PlusOutlined />}
          size="small"
          onClick={handleCreate}
        >
          {isMobile ? "新建" : "新建供应商"}
        </Button>
      </div>

      <ResponsiveTable
        columns={columns}
        dataSource={providers}
        rowKey="id"
        loading={loading}
        pagination={false}
        renderMobileCard={renderMobileCard}
        scroll={{ x: 800 }}
      />

      {/* 新建/编辑弹窗 */}
      <Modal
        title={editing ? "编辑供应商" : "新建供应商"}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical" initialValues={{ status: 1 }}>
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: "请输入供应商名称" }]}
          >
            <Input placeholder="如 DeepSeek 官方" maxLength={100} />
          </Form.Item>
          <Form.Item
            label="Base URL"
            name="base_url"
            rules={[{ required: true, message: "请输入 Base URL" }]}
          >
            <Input placeholder="https://api.deepseek.com" />
          </Form.Item>
          <Form.Item
            label="API Key"
            name="api_key"
            rules={[{ required: true, message: "请输入 API Key" }]}
          >
            <Input.Password placeholder="sk-..." />
          </Form.Item>

          {/* 模型清单 */}
          <Form.Item label="可用模型">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {editing && (
                  <Button
                    size="small"
                    icon={<CloudSyncOutlined />}
                    loading={fetchingModels}
                    onClick={handleFetchModels}
                  >
                    一键拉取
                  </Button>
                )}
                {models.length > 0 && (
                  <Popconfirm
                    title="确定清空所有模型？"
                    onConfirm={() => setModels([])}
                    okText="清空"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button size="small" danger>
                      清空
                    </Button>
                  </Popconfirm>
                )}
                {models.length > 0 && (
                  <Input
                    size="small"
                    placeholder="搜索模型..."
                    value={modelFilter}
                    onChange={(e) => setModelFilter(e.target.value)}
                    allowClear
                    style={{ width: 200 }}
                  />
                )}
                <span className="text-xs text-gray-400">
                  {models.length > 0 && (
                    <>
                      共 {models.length} 个
                      {modelFilter && ` · 显示 ${filteredModels.length} 个`}
                    </>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
                {filteredModels.length > 0 ? (
                  filteredModels.map((m) => (
                    <Tag
                      key={m}
                      closable
                      onClose={() => removeModel(m)}
                      className="cursor-pointer"
                    >
                      {m}
                    </Tag>
                  ))
                ) : models.length > 0 ? (
                  <span className="text-sm text-gray-400">无匹配模型</span>
                ) : (
                  <span className="text-sm text-gray-400">暂无模型</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  size="small"
                  placeholder="输入模型名"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  onPressEnter={addModel}
                  style={{ width: 300 }}
                />
                <Button size="small" onClick={addModel} type="text">
                  添加
                </Button>
              </div>
            </div>
          </Form.Item>

          <Form.Item label="状态" name="status">
            <Space>
              <Tag
                className="cursor-pointer"
                color="success"
                onClick={() => form.setFieldValue("status", 1)}
              >
                启用
              </Tag>
              <Tag
                className="cursor-pointer"
                onClick={() => form.setFieldValue("status", 0)}
              >
                停用
              </Tag>
            </Space>
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <TextArea placeholder="可选备注" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ProviderTab;
