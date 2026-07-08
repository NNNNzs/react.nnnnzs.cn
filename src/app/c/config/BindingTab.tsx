/**
 * AI 场景绑定 Tab
 * 按 scenario 分组展示绑定列表，支持新建/编辑/激活/折叠/搜索
 */

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Button,
  Collapse,
  Input,
  Select,
  Form,
  Modal,
  Tag,
  Space,
  message,
  Tooltip,
  InputNumber,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  CheckCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { AI_BINDING_FIELD_LABELS, type AiBindingField } from "@/lib/ai-scenarios";

interface ProviderOption {
  id: number;
  name: string;
  base_url: string;
  models: string[];
}

interface BindingRecord {
  id: number;
  scenario: string;
  provider_id: number;
  model: string;
  name: string | null;
  remark: string | null;
  temperature: number | null;
  max_tokens: number | null;
  dimensions: number | null;
  api_mode: string | null;
  voice: string | null;
  is_active: boolean;
  provider: { id: number; name: string; base_url: string; api_key: string };
}

interface ScenarioMeta {
  key: string;
  label: string;
  description: string;
  optionalFields: string[];
}

function BindingTab() {
  const [bindings, setBindings] = useState<Record<string, BindingRecord[]>>({});
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
  const [editing, setEditing] = useState<BindingRecord | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [searchText, setSearchText] = useState("");
  const [scenarioForm] = Form.useForm();
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    try {
      const [bindingsRes, providersRes] = await Promise.all([
        axios.get("/api/config/ai/bindings"),
        axios.get("/api/config/ai/providers"),
      ]);
      if (bindingsRes.data.status) {
        setBindings(bindingsRes.data.data?.bindings || {});
        setScenarios(bindingsRes.data.data?.scenarios || []);
      }
      if (providersRes.data.status) {
        setProviders(
          (providersRes.data.data || []).map((p: ProviderOption) => ({
            id: p.id,
            name: p.name,
            base_url: p.base_url,
            models: p.models || [],
          })),
        );
      }
    } catch {
      message.error("加载场景绑定失败");
    }
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 当前表单选中的 provider 可用模型列表 */
  const selectedProviderId = Form.useWatch("provider_id", form);
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId),
    [providers, selectedProviderId],
  );

  /** 搜索过滤后的场景列表 */
  const filteredScenarios = useMemo(() => {
    if (!searchText.trim()) return scenarios;
    const q = searchText.trim().toLowerCase();
    return scenarios.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.key.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }, [scenarios, searchText]);

  const handleCreate = (scenarioKey: string) => {
    setEditing(null);
    setSelectedScenario(scenarioKey);
    form.resetFields();
    form.setFieldsValue({ scenario: scenarioKey });
    setIsModalOpen(true);
  };

  const handleEdit = (record: BindingRecord) => {
    setEditing(record);
    setSelectedScenario(record.scenario);
    form.setFieldsValue({
      scenario: record.scenario,
      provider_id: record.provider_id,
      model: record.model,
      name: record.name,
      remark: record.remark,
      temperature: record.temperature,
      max_tokens: record.max_tokens,
      dimensions: record.dimensions,
      api_mode: record.api_mode,
      voice: record.voice,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = { ...values };
      if (editing) {
        payload.id = editing.id;
      }
      const scenarioBindings = bindings[selectedScenario] || [];
      if (!editing && scenarioBindings.length === 0) {
        payload.is_active = true;
      }

      const res = await axios.put("/api/config/ai/bindings", payload);
      if (res.data.status) {
        message.success(editing ? "绑定已更新" : "绑定已创建");
        setIsModalOpen(false);
        loadData();
      } else {
        message.error(res.data.message || "保存失败");
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        message.error(err.response.data.message);
      } else {
        message.error("保存失败");
      }
    }
  };

  const handleSaveScenario = async () => {
    try {
      const values = await scenarioForm.validateFields();
      const res = await axios.post("/api/config/ai/scenarios", values);
      if (res.data.status) {
        message.success("场景已创建");
        setIsScenarioModalOpen(false);
        scenarioForm.resetFields();
        loadData();
      } else {
        message.error(res.data.message || "创建失败");
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        message.error(err.response.data.message);
      } else {
        message.error("创建场景失败");
      }
    }
  };

  const handleActivate = async (id: number) => {
    try {
      const res = await axios.post(`/api/config/ai/bindings/${id}/activate`);
      if (res.data.status) {
        message.success("绑定已激活");
        loadData();
      } else {
        message.error(res.data.message || "激活失败");
      }
    } catch {
      message.error("激活失败");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/config/ai/bindings/${id}`);
      message.success("绑定已删除");
      loadData();
    } catch {
      message.error("删除失败");
    }
  };

  /** 当前场景的可选字段 */
  const currentScenarioMeta = useMemo(
    () => scenarios.find((s) => s.key === selectedScenario),
    [scenarios, selectedScenario],
  );
  const optionalFields: AiBindingField[] = (currentScenarioMeta?.optionalFields || []) as AiBindingField[];

  /** 渲染场景可选参数表单项 */
  const renderFieldInput = (field: AiBindingField) => {
    const label = AI_BINDING_FIELD_LABELS[field];
    switch (field) {
      case "temperature":
        return (
          <Form.Item label={label} name="temperature">
            <InputNumber min={0} max={2} step={0.1} placeholder="如 0.7" style={{ width: "100%" }} />
          </Form.Item>
        );
      case "max_tokens":
        return (
          <Form.Item label={label} name="max_tokens">
            <InputNumber min={1} max={128000} step={256} placeholder="如 4096" style={{ width: "100%" }} />
          </Form.Item>
        );
      case "dimensions":
        return (
          <Form.Item label={label} name="dimensions">
            <InputNumber min={128} max={8192} step={128} placeholder="如 1024" style={{ width: "100%" }} />
          </Form.Item>
        );
      case "api_mode":
        return (
          <Form.Item label={label} name="api_mode">
            <Input placeholder="如 dall-e-3" />
          </Form.Item>
        );
      case "voice":
        return (
          <Form.Item label={label} name="voice">
            <Input placeholder="音色名称" />
          </Form.Item>
        );
      default:
        return null;
    }
  };

  /** 构造 Collapse items */
  const collapseItems = filteredScenarios.map((scenario) => {
    const scenarioBindings = bindings[scenario.key] || [];
    const activeCount = scenarioBindings.filter((b) => b.is_active).length;

    return {
      key: scenario.key,
      label: (
        <div className="flex items-center gap-2">
          <span className="font-medium">{scenario.label}</span>
          <span className="text-xs text-gray-400 hidden sm:inline">{scenario.description}</span>
          {scenarioBindings.length > 0 && (
            <Tag className="ml-auto" color={activeCount > 0 ? "success" : "default"}>
              {scenarioBindings.length} 条{activeCount > 0 && ` · ${activeCount} 激活`}
            </Tag>
          )}
        </div>
      ),
      extra: (
        <Button
          size="small"
          type="text"
          icon={<PlusOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleCreate(scenario.key);
          }}
        >
          新建
        </Button>
      ),
      children: (
        <>
          {scenarioBindings.length === 0 ? (
            <div className="text-sm text-gray-400 py-2">暂无绑定，点击上方「新建」添加</div>
          ) : (
            <div className="space-y-2">
              {scenarioBindings.map((b) => (
                <div
                  key={b.id}
                  className={`flex items-center justify-between gap-3 p-2 rounded border ${
                    b.is_active
                      ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {b.is_active && (
                        <Tag color="success" className="shrink-0">
                          <CheckCircleOutlined /> 激活中
                        </Tag>
                      )}
                      <span className="font-medium truncate">{b.name || b.model}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {b.provider.name} · {b.model}
                      {b.temperature != null && ` · T=${b.temperature}`}
                      {b.max_tokens != null && ` · max=${b.max_tokens}`}
                      {b.dimensions != null && ` · dim=${b.dimensions}`}
                      {b.api_mode && ` · ${b.api_mode}`}
                      {b.voice && ` · ${b.voice}`}
                    </div>
                  </div>
                  <Space size={4} className="shrink-0">
                    {!b.is_active && (
                      <Tooltip title="激活此绑定">
                        <Button
                          size="small"
                          type="text"
                          icon={<ThunderboltOutlined />}
                          onClick={() => handleActivate(b.id)}
                        />
                      </Tooltip>
                    )}
                    <Button
                      size="small"
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(b)}
                    />
                    <Popconfirm
                      title="确定删除此绑定？"
                      onConfirm={() => handleDelete(b.id)}
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              ))}
            </div>
          )}
        </>
      ),
    };
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 shrink-0 flex items-center gap-3">
        <Input
          placeholder="搜索场景..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ maxWidth: 300 }}
        />
        <div className="flex-1" />
        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={() => {
            scenarioForm.resetFields();
            setIsScenarioModalOpen(true);
          }}
        >
          新增场景
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {filteredScenarios.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            {searchText ? "无匹配场景" : "暂无场景，请点击「新增场景」创建"}
          </div>
        ) : (
          <Collapse items={collapseItems} defaultActiveKey={[]} />
        )}
      </div>

      {/* 新建/编辑绑定弹窗 */}
      <Modal
        title={editing ? "编辑场景绑定" : "新建场景绑定"}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical">
          <Form.Item label="场景" name="scenario">
            <Select disabled options={scenarios.map((s) => ({ label: s.label, value: s.key }))} />
          </Form.Item>
          <Form.Item
            label="供应商"
            name="provider_id"
            rules={[{ required: true, message: "请选择供应商" }]}
          >
            <Select
              placeholder="选择供应商"
              options={providers.map((p) => ({ label: p.name, value: p.id }))}
              onChange={() => form.setFieldValue("model", undefined)}
            />
          </Form.Item>
          <Form.Item
            label="模型"
            name="model"
            rules={[{ required: true, message: "请选择或输入模型" }]}
          >
            <Select
              placeholder="选择或输入模型名"
              showSearch
              allowClear
              options={(selectedProvider?.models || []).map((m) => ({ label: m, value: m }))}
              notFoundContent={
                selectedProvider?.models?.length
                  ? "无匹配模型"
                  : "该供应商暂无模型清单，可直接输入"
              }
              filterOption={false}
              onOpenChange={(open) => {
                if (open && !selectedProvider?.models?.length) {
                  message.info("无模型清单，请直接输入模型名");
                }
              }}
            />
          </Form.Item>
          <Form.Item label="绑定名称" name="name">
            <Input placeholder="可选，如 DeepSeek-Chat 主用" maxLength={100} />
          </Form.Item>
          {optionalFields.map(renderFieldInput)}
          <Form.Item label="备注" name="remark">
            <Input.TextArea placeholder="可选备注" rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新增场景弹窗 */}
      <Modal
        title="新增场景"
        open={isScenarioModalOpen}
        onOk={handleSaveScenario}
        onCancel={() => setIsScenarioModalOpen(false)}
        okText="创建"
        cancelText="取消"
        width={480}
        destroyOnHidden
      >
        <Form form={scenarioForm} layout="vertical">
          <Form.Item
            label="场景 Key"
            name="key"
            rules={[
              { required: true, message: "请输入场景 Key" },
              { pattern: /^[a-z0-9_]+$/, message: "仅小写字母、数字、下划线" },
            ]}
          >
            <Input placeholder="如 my_custom_agent" maxLength={50} />
          </Form.Item>
          <Form.Item label="显示名称" name="label" rules={[{ required: true, message: "请输入名称" }]}>
            <Input placeholder="如 我的 Agent" maxLength={100} />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="可选描述" rows={2} />
          </Form.Item>
          <Form.Item label="可选参数字段" name="optionalFields">
            <Select
              mode="multiple"
              placeholder="选择该场景需要的额外参数"
              options={[
                { label: "温度 (temperature)", value: "temperature" },
                { label: "最大 Token (max_tokens)", value: "max_tokens" },
                { label: "向量维度 (dimensions)", value: "dimensions" },
                { label: "接口模式 (api_mode)", value: "api_mode" },
                { label: "默认音色 (voice)", value: "voice" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BindingTab;
