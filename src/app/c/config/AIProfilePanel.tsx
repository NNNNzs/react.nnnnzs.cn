"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Tag,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  CopyOutlined,
  PlusOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import axios from "axios";
import {
  AI_FIELD_LABELS,
  AI_SCENARIO_META,
  getAIScenarioKeys,
  normalizeAIScenarioKey,
  type AIActiveProfileMap,
  type AIConfigField,
  type AIConfigProfile,
  type AIFallbackProfileMap,
  type AIProfileScenarioConfig,
  type AIProfileScenarioMeta,
  type AIProfileState,
  type AIScenarioProfileMap,
} from "@/lib/ai-config-profiles";
import type { AIConfigScenario } from "@/lib/ai-config";

interface AIProfilesResponse extends AIProfileState {
  legacyProfiles: Partial<Record<AIConfigScenario, AIConfigProfile>>;
}

interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

type ProfileFormValues = Pick<AIConfigProfile, "name" | "description"> & {
  config: AIProfileScenarioConfig;
};

interface ScenarioFormValues {
  key: string;
  label: string;
  description?: string;
  requiredFields?: AIConfigField[];
  optionalFields?: AIConfigField[];
}

const DEFAULT_STATE: AIProfileState = {
  version: 1,
  scenarioProfiles: {},
  scenarioMetas: AI_SCENARIO_META,
  activeProfileIds: {},
  fallbackProfileIds: {},
};

const FIELD_OPTIONS = Object.entries(AI_FIELD_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function createProfileId(scenario: AIConfigScenario) {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${scenario}-${suffix}`;
}

function cloneProfile(profile: AIConfigProfile, patch: Partial<AIConfigProfile> = {}): AIConfigProfile {
  return {
    ...profile,
    ...patch,
    config: { ...profile.config },
  };
}

function maskSecret(value?: string) {
  if (!value) return "未填写";
  if (value.length <= 10) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getProfileSummary(profile?: AIConfigProfile) {
  if (!profile) return "未配置";
  return profile.config.model || profile.config.base_url || "未填写模型";
}

function getFieldInput(field: AIConfigField) {
  if (field === "api_key") {
    return <Input.Password placeholder="sk-..." autoComplete="off" />;
  }

  if (field === "api_mode") {
    return (
      <Select
        placeholder="选择接口模式"
        getPopupContainer={() => document.body}
        options={[
          { label: "images_generations", value: "images_generations" },
          { label: "chat_completions", value: "chat_completions" },
        ]}
        allowClear
      />
    );
  }

  return <Input placeholder={AI_FIELD_LABELS[field]} />;
}

function mergeScenarioProfiles(
  scenarioProfiles: AIScenarioProfileMap,
  scenario: AIConfigScenario,
  profiles: AIConfigProfile[],
): AIScenarioProfileMap {
  return {
    ...scenarioProfiles,
    [scenario]: profiles,
  };
}

function mergeActiveProfile(
  activeProfileIds: AIActiveProfileMap,
  scenario: AIConfigScenario,
  profileId: string | undefined,
): AIActiveProfileMap {
  return {
    ...activeProfileIds,
    [scenario]: profileId,
  };
}

function mergeFallbackProfiles(
  fallbackProfileIds: AIFallbackProfileMap,
  scenario: AIConfigScenario,
  profileIds: string[],
): AIFallbackProfileMap {
  return {
    ...fallbackProfileIds,
    [scenario]: profileIds,
  };
}

export default function AIProfilePanel() {
  const [state, setState] = useState<AIProfileState>(DEFAULT_STATE);
  const [legacyProfiles, setLegacyProfiles] = useState<Partial<Record<AIConfigScenario, AIConfigProfile>>>({});
  const [selectedScenario, setSelectedScenario] = useState<AIConfigScenario>("chat");
  const [selectedProfileIds, setSelectedProfileIds] = useState<Partial<Record<AIConfigScenario, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
  const [form] = Form.useForm<ProfileFormValues>();
  const [scenarioForm] = Form.useForm<ScenarioFormValues>();

  const profiles = useMemo(
    () => state.scenarioProfiles[selectedScenario] ?? [],
    [selectedScenario, state.scenarioProfiles],
  );
  const activeProfileId = state.activeProfileIds[selectedScenario];
  const fallbackProfileIds = state.fallbackProfileIds[selectedScenario] ?? [];
  const selectedProfileId = selectedProfileIds[selectedScenario] ?? activeProfileId ?? profiles[0]?.id;
  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  const loadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get<ApiResponse<AIProfilesResponse>>("/api/config/ai-profiles", {
        headers: { "Cache-Control": "no-store" },
      });

      if (!response.data.status) {
        message.error(response.data.message || "加载 AI 配置组失败");
        return;
      }

      const data = response.data.data;
      setState({
        version: 1,
        scenarioProfiles: data.scenarioProfiles,
        scenarioMetas: data.scenarioMetas,
        activeProfileIds: data.activeProfileIds,
        fallbackProfileIds: data.fallbackProfileIds,
      });
      setLegacyProfiles(data.legacyProfiles);
      setSelectedProfileIds((current) => {
        const next = { ...current };
        for (const scenario of getAIScenarioKeys(data)) {
          const scenarioProfiles = data.scenarioProfiles[scenario] ?? [];
          if (!next[scenario] || !scenarioProfiles.some((profile) => profile.id === next[scenario])) {
            next[scenario] = data.activeProfileIds[scenario] ?? scenarioProfiles[0]?.id;
          }
        }
        return next;
      });
    } catch (error) {
      console.error("加载 AI 配置组失败:", error);
      message.error("加载 AI 配置组失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    if (!selectedProfile) {
      form.resetFields();
      return;
    }

    form.setFieldsValue({
      name: selectedProfile.name,
      description: selectedProfile.description,
      config: selectedProfile.config,
    });
  }, [form, selectedProfile]);

  const saveState = useCallback(async (nextState: AIProfileState) => {
    setSaving(true);
    try {
      const response = await axios.put<ApiResponse<AIProfileState>>("/api/config/ai-profiles", nextState);

      if (!response.data.status) {
        message.error(response.data.message || "保存 AI 配置组失败");
        return false;
      }

      setState(response.data.data);
      message.success("AI 配置组已保存");
      return true;
    } catch (error) {
      console.error("保存 AI 配置组失败:", error);
      message.error("保存 AI 配置组失败");
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const scenarioKeys = useMemo(() => getAIScenarioKeys(state), [state]);

  const buildStateWithSelectedForm = async () => {
    if (!selectedProfile) return state;

    const values = await form.validateFields();
    const nextProfile: AIConfigProfile = {
      ...selectedProfile,
      name: values.name.trim(),
      description: values.description?.trim(),
      config: values.config ?? {},
    };
    const nextProfiles = profiles.map((profile) =>
      profile.id === selectedProfile.id ? nextProfile : profile,
    );

    return {
      ...state,
      scenarioProfiles: mergeScenarioProfiles(state.scenarioProfiles, selectedScenario, nextProfiles),
    };
  };

  const handleCreateBlank = () => {
    const profile: AIConfigProfile = {
      id: createProfileId(selectedScenario),
      name: "新配置组",
      description: "",
      config: {},
    };
    setState((current) => ({
      ...current,
      scenarioProfiles: mergeScenarioProfiles(
        current.scenarioProfiles,
        selectedScenario,
        [profile, ...(current.scenarioProfiles[selectedScenario] ?? [])],
      ),
    }));
    setSelectedProfileIds((current) => ({ ...current, [selectedScenario]: profile.id }));
  };

  const handleOpenScenarioModal = () => {
    scenarioForm.setFieldsValue({
      requiredFields: ["api_key", "model", "base_url"],
      optionalFields: ["temperature", "max_tokens"],
    });
    setIsScenarioModalOpen(true);
  };

  const handleCreateScenario = async () => {
    const values = await scenarioForm.validateFields();
    const key = normalizeAIScenarioKey(values.key);

    if (!key) {
      message.error("场景 Key 不能为空");
      return;
    }

    if (state.scenarioMetas[key]) {
      message.error("场景 Key 已存在");
      return;
    }

    const requiredFields = values.requiredFields ?? ["api_key", "model", "base_url"];
    const optionalFields = (values.optionalFields ?? []).filter((field) => !requiredFields.includes(field));
    const meta: AIProfileScenarioMeta = {
      label: values.label.trim(),
      description: values.description?.trim() ?? "",
      requiredFields,
      optionalFields,
    };
    const nextState: AIProfileState = {
      ...state,
      scenarioMetas: {
        ...state.scenarioMetas,
        [key]: meta,
      },
      scenarioProfiles: {
        ...state.scenarioProfiles,
        [key]: [],
      },
    };
    const saved = await saveState(nextState);

    if (saved) {
      setSelectedScenario(key);
      setIsScenarioModalOpen(false);
      scenarioForm.resetFields();
    }
  };

  const handleCreateFromLegacy = () => {
    const legacyProfile = legacyProfiles[selectedScenario];
    if (!legacyProfile) {
      message.warning("当前场景没有可迁移的散配置");
      return;
    }

    const profile = cloneProfile(legacyProfile, {
      id: createProfileId(selectedScenario),
      name: "从当前配置迁移",
    });
    setState((current) => ({
      ...current,
      scenarioProfiles: mergeScenarioProfiles(
        current.scenarioProfiles,
        selectedScenario,
        [profile, ...(current.scenarioProfiles[selectedScenario] ?? [])],
      ),
    }));
    setSelectedProfileIds((current) => ({ ...current, [selectedScenario]: profile.id }));
  };

  const handleSaveSelected = async () => {
    if (!selectedProfile) return;

    const nextState = await buildStateWithSelectedForm();
    const saved = await saveState({
      ...nextState,
      activeProfileIds: {
        ...nextState.activeProfileIds,
        [selectedScenario]: nextState.activeProfileIds[selectedScenario] ?? selectedProfile.id,
      },
    });

    if (saved) {
      setSelectedProfileIds((current) => ({ ...current, [selectedScenario]: selectedProfile.id }));
    }
  };

  const handleActivate = async (profileId: string) => {
    const nextState = await buildStateWithSelectedForm();
    const nextFallbackIds = (nextState.fallbackProfileIds[selectedScenario] ?? []).filter((id) => id !== profileId);
    const saved = await saveState({
      ...nextState,
      activeProfileIds: mergeActiveProfile(nextState.activeProfileIds, selectedScenario, profileId),
      fallbackProfileIds: mergeFallbackProfiles(nextState.fallbackProfileIds, selectedScenario, nextFallbackIds),
    });

    if (saved) {
      setSelectedProfileIds((current) => ({ ...current, [selectedScenario]: profileId }));
    }
  };

  const handleDelete = async (profileId: string) => {
    const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
    const nextActiveProfileId = activeProfileId === profileId
      ? nextProfiles[0]?.id
      : activeProfileId;
    const nextFallbackIds = fallbackProfileIds.filter((id) => id !== profileId && id !== nextActiveProfileId);
    const nextState: AIProfileState = {
      ...state,
      scenarioProfiles: mergeScenarioProfiles(state.scenarioProfiles, selectedScenario, nextProfiles),
      activeProfileIds: mergeActiveProfile(state.activeProfileIds, selectedScenario, nextActiveProfileId),
      fallbackProfileIds: mergeFallbackProfiles(state.fallbackProfileIds, selectedScenario, nextFallbackIds),
    };
    const saved = await saveState(nextState);

    if (saved) {
      setSelectedProfileIds((current) => ({ ...current, [selectedScenario]: nextActiveProfileId }));
    }
  };

  const handleFallbackChange = async (profileIds: string[]) => {
    const saved = await saveState({
      ...state,
      fallbackProfileIds: mergeFallbackProfiles(state.fallbackProfileIds, selectedScenario, profileIds),
    });

    if (!saved) {
      return;
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spin />
      </div>
    );
  }

  const meta = state.scenarioMetas[selectedScenario] ?? AI_SCENARIO_META[selectedScenario];
  const fields = [...meta.requiredFields, ...meta.optionalFields];
  const fallbackOptions = profiles
    .filter((profile) => profile.id !== activeProfileId)
    .map((profile) => ({
      label: `${profile.name} / ${getProfileSummary(profile)}`,
      value: profile.id,
    }));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-visible">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-visible xl:grid-cols-[220px_320px_minmax(0,1fr)]">
        <div className="min-h-0 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
          <Button block icon={<PlusOutlined />} onClick={handleOpenScenarioModal}>
            新增场景
          </Button>
          <div className="mt-2 space-y-2">
            {scenarioKeys.map((scenario) => {
              const scenarioMeta = state.scenarioMetas[scenario] ?? AI_SCENARIO_META[scenario];
              const scenarioProfiles = state.scenarioProfiles[scenario] ?? [];
              const scenarioActiveId = state.activeProfileIds[scenario];
              const scenarioActive = scenarioProfiles.find((profile) => profile.id === scenarioActiveId);

              return (
                <button
                  key={scenario}
                  type="button"
                  onClick={() => setSelectedScenario(scenario)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedScenario === scenario
                      ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {scenarioMeta.label}
                    </span>
                    <Tag>{scenarioProfiles.length}</Tag>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {getProfileSummary(scenarioActive)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="shrink-0 border-b border-slate-200 p-3 dark:border-slate-800">
            <div className="grid grid-cols-2 gap-2">
              <Button icon={<PlusOutlined />} onClick={handleCreateBlank}>
                新建
              </Button>
              <Button icon={<CopyOutlined />} onClick={handleCreateFromLegacy}>
                迁移当前
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {profiles.length === 0 ? (
              <Empty description="暂无配置组" />
            ) : (
              <div className="space-y-2">
                {profiles.map((profile) => {
                  const isActive = profile.id === activeProfileId;
                  const isSelected = profile.id === selectedProfile?.id;

                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => setSelectedProfileIds((current) => ({ ...current, [selectedScenario]: profile.id }))}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                          {profile.name}
                        </span>
                        {isActive && <Tag color="success">运行中</Tag>}
                      </div>
                      <div className="mt-2 truncate text-xs text-slate-500">
                        {profile.config.base_url || "未配置地址"}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500">
                        {profile.config.model || "未配置模型"} / {maskSecret(profile.config.api_key)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-visible rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          {!selectedProfile ? (
            <div className="flex h-full items-center justify-center">
              <Empty description="请选择或创建配置组" />
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {meta.label}
                      </h2>
                      {selectedProfile.id === activeProfileId && <Tag color="success">运行中</Tag>}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{meta.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={saving}
                      onClick={handleSaveSelected}
                    >
                      保存
                    </Button>
                    <Button
                      icon={<CheckCircleOutlined />}
                      disabled={selectedProfile.id === activeProfileId}
                      loading={saving}
                      onClick={() => handleActivate(selectedProfile.id)}
                    >
                      激活
                    </Button>
                    <Popconfirm
                      title="删除配置组"
                      description="删除后不可恢复，确定继续吗？"
                      okText="删除"
                      cancelText="取消"
                      onConfirm={() => handleDelete(selectedProfile.id)}
                    >
                      <Button danger disabled={saving}>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <Form form={form} layout="vertical">
                  <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
                    <Form.Item
                      label="配置组名称"
                      name="name"
                      rules={[{ required: true, message: "请输入配置组名称" }]}
                    >
                      <Input maxLength={40} />
                    </Form.Item>
                    <Form.Item label="说明" name="description">
                      <Input maxLength={120} />
                    </Form.Item>
                  </div>

                  <div className="grid grid-cols-1 gap-3 2xl:grid-cols-3">
                    {fields.map((field) => (
                      <Form.Item
                        key={`${selectedScenario}.${field}`}
                        label={AI_FIELD_LABELS[field]}
                        name={["config", field]}
                        rules={
                          meta.requiredFields.includes(field)
                            ? [{ required: true, message: `请输入${AI_FIELD_LABELS[field]}` }]
                            : undefined
                        }
                      >
                        {getFieldInput(field)}
                      </Form.Item>
                    ))}
                  </div>

                  {selectedScenario === "image_gen" && (
                    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                      <Form.Item label="降级顺序">
                        <Select
                          mode="multiple"
                          value={fallbackProfileIds}
                          options={fallbackOptions}
                          getPopupContainer={() => document.body}
                          placeholder="选择备用图片生成配置"
                          onChange={handleFallbackChange}
                        />
                      </Form.Item>
                    </div>
                  )}
                </Form>
              </div>
            </>
          )}
        </div>
      </div>
      <Modal
        title="新增 AI 应用场景"
        open={isScenarioModalOpen}
        onOk={handleCreateScenario}
        onCancel={() => setIsScenarioModalOpen(false)}
        okText="创建"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={scenarioForm} layout="vertical">
          <Form.Item
            label="场景 Key"
            name="key"
            extra="例如 custom_chat、agent_review。代码中通过 getAIConfig('场景Key') 读取。"
            rules={[
              { required: true, message: "请输入场景 Key" },
              {
                pattern: /^[a-z][a-z0-9_]*$/,
                message: "只能使用小写字母、数字和下划线，并以字母开头",
              },
            ]}
          >
            <Input placeholder="custom_chat" />
          </Form.Item>
          <Form.Item
            label="显示名称"
            name="label"
            rules={[{ required: true, message: "请输入显示名称" }]}
          >
            <Input placeholder="新的 AI 场景" maxLength={40} />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input placeholder="这个场景会被哪里使用" maxLength={120} />
          </Form.Item>
          <Form.Item
            label="必填字段"
            name="requiredFields"
            rules={[{ required: true, message: "请选择必填字段" }]}
          >
            <Select mode="multiple" options={FIELD_OPTIONS} getPopupContainer={() => document.body} />
          </Form.Item>
          <Form.Item label="可选字段" name="optionalFields">
            <Select mode="multiple" options={FIELD_OPTIONS} getPopupContainer={() => document.body} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
