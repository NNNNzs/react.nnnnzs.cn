/**
 * 长期Token申请卡片组件
 */

"use client";

import React, { useState, useCallback } from "react";
import {
  Card,
  Button,
  message,
  Space,
  Typography,
  Select,
  Divider,
  Alert,
  Tag,
  Modal,
  Input,
  Tooltip,
} from "antd";
import {
  KeyOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  CheckOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import axios from "axios";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface LongTermTokenCardProps {
  userId?: string;
}

interface TokenRecord {
  id: string;
  token: string;
  expiresAt: string | null;
  createdAt: string;
  description: string;
  lastUsed: string | null;
}

const LongTermTokenCard: React.FC<LongTermTokenCardProps> = () => {
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [duration, setDuration] = useState<7 | 30 | 0>(7);
  const [description, setDescription] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tokens, setTokens] = useState<TokenRecord[]>([]);

  // 加载token列表
  const loadTokens = useCallback(async () => {
    try {
      const response = await axios.get("/api/user/token/long-term");
      if (response.data.status) {
        setTokens(response.data.data);
      }
    } catch (error) {
      console.error("加载Token列表失败:", error);
    }
  }, []);

  // 生成Token
  const handleGenerateToken = useCallback(async () => {
    if (duration === null || duration === undefined) {
      message.error("请选择有效期");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post("/api/user/token/long-term", {
        duration,
        description: description || `长期Token - ${getDurationLabel(duration)}`,
      });

      if (response.data.status) {
        setGeneratedToken(response.data.data.token);
        message.success("Token生成成功，请妥善保存！");
        // 刷新token列表
        loadTokens();
      } else {
        message.error(response.data.message || "生成失败");
      }
    } catch {
      message.error("生成Token失败");
    } finally {
      setLoading(false);
    }
  }, [duration, description, loadTokens]);

  // 复制Token
  const handleCopy = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      setCopied(true);
      message.success("已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 复制列表中的Token
  const handleCopyTokenFromList = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      message.success("Token已复制到剪贴板");
    } catch {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = token;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      message.success("Token已复制到剪贴板");
    }
  };

  // 显示/隐藏Token
  const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());

  const toggleTokenVisibility = (tokenId: string) => {
    const newVisible = new Set(visibleTokens);
    if (newVisible.has(tokenId)) {
      newVisible.delete(tokenId);
    } else {
      newVisible.add(tokenId);
    }
    setVisibleTokens(newVisible);
  };

  // 删除Token
  const handleDelete = useCallback(async (tokenId: string) => {
    Modal.confirm({
      title: "确认删除",
      content: "确定要删除这个Token吗？删除后将无法恢复。",
      icon: <ExclamationCircleOutlined />,
      okText: "确认",
      cancelText: "取消",
      onOk: async () => {
        try {
          const response = await axios.delete(
            `/api/user/token/long-term?id=${tokenId}`
          );
          if (response.data.status) {
            message.success("删除成功");
            loadTokens();
          } else {
            message.error(response.data.message || "删除失败");
          }
        } catch (error) {
          console.error("删除Token失败:", error);
          message.error("删除失败");
        }
      },
    });
  }, [loadTokens]);

  // 获取有效期标签
  const getDurationLabel = (days: number) => {
    if (days === 0) return "永久";
    if (days === 7) return "7天";
    if (days === 30) return "30天";
    return `${days}天`;
  };

  // 获取过期时间显示
  const getExpiryText = (expiresAt: string | null) => {
    if (!expiresAt) return <Tag color="blue">永久有效</Tag>;
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <Tag color="red">已过期</Tag>;
    } else if (diffDays <= 3) {
      return <Tag color="orange">{diffDays}天后过期</Tag>;
    } else {
      return <Tag color="green">{expiry.toLocaleDateString()}</Tag>;
    }
  };

  // 重置表单
  const resetForm = () => {
    setDuration(7);
    setDescription("");
    setGeneratedToken(null);
    setCopied(false);
  };

  // 切换显示表单
  const toggleForm = () => {
    const newShow = !showForm;
    setShowForm(newShow);
    if (newShow) {
      resetForm();
    }
  };

  // 组件挂载时加载token列表
  React.useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  return (
    <Card
      title={
        <Space>
          <KeyOutlined />
          <span>长期Token管理</span>
        </Space>
      }
      extra={
        <Button type="primary" onClick={toggleForm} size="small">
          {showForm ? "收起" : "申请新Token"}
        </Button>
      }
    >
      {/* 说明提示 */}
      <Alert
        message="长期Token说明"
        description="长期Token可用于API调用或第三方应用集成。请妥善保管生成的Token，不要泄露给他人。"
        type="info"
        showIcon
        className="mb-4"
      />

      {/* 申请表单 */}
      {showForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <Title level={5} style={{ marginBottom: 16 }}>
            申请新Token
          </Title>

          <Space direction="vertical" className="w-full" size="middle">
            <div>
              <Text strong className="block mb-2">
                有效期选择
              </Text>
              <Select
                value={duration}
                onChange={(value) => setDuration(value)}
                className="w-full"
                size="large"
              >
                <Option value={7}>7天</Option>
                <Option value={30}>30天</Option>
                <Option value={0}>永久</Option>
              </Select>
            </div>

            <div>
              <Text strong className="block mb-2">
                用途说明（可选）
              </Text>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：用于移动端API调用"
                size="large"
                maxLength={50}
              />
              <Text type="secondary" className="text-xs">
                {description.length}/50 字符
              </Text>
            </div>

            <div className="flex gap-2">
              <Button
                type="primary"
                onClick={handleGenerateToken}
                loading={loading}
                icon={<KeyOutlined />}
                size="large"
              >
                生成Token
              </Button>
              <Button onClick={resetForm} size="large">
                重置
              </Button>
            </div>

            {/* 生成的Token显示 */}
            {generatedToken && (
              <div className="mt-4 p-4 bg-white border border-gray-200 rounded">
                <div className="flex items-center justify-between mb-2">
                  <Text strong>生成的Token：</Text>
                  <Tooltip title={copied ? "已复制" : "复制"}>
                    <Button
                      size="small"
                      icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                      onClick={handleCopy}
                      type={copied ? "primary" : "default"}
                    />
                  </Tooltip>
                </div>
                <Paragraph
                  copyable={{ text: generatedToken }}
                  className="bg-gray-100 p-2 rounded font-mono text-sm break-all"
                >
                  {generatedToken}
                </Paragraph>
                <Alert
                  message="Token已生成"
                  description="请复制并保存此Token。您也可以在下方的Token列表中查看所有已生成的Token。"
                  type="success"
                  showIcon
                  className="mt-2"
                />
              </div>
            )}
          </Space>

          <Divider />
        </div>
      )}

      {/* Token列表 */}
      <div>
        <Title level={5} style={{ marginBottom: 12 }}>
          已生成的Token ({tokens.length})
        </Title>

        {tokens.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ClockCircleOutlined style={{ fontSize: 48, marginBottom: 8 }} />
            <div>暂无长期Token</div>
            <div className="text-sm mt-2">点击&quot;申请新Token&quot;按钮开始创建</div>
          </div>
        ) : (
          <Space direction="vertical" className="w-full" size="middle">
            {tokens.map((token) => {
              const isVisible = visibleTokens.has(token.id);
              return (
                <div
                  key={token.id}
                  className="p-3 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Text strong>{token.description}</Text>
                        {getExpiryText(token.expiresAt)}
                      </div>
                      <Text type="secondary" className="text-xs font-mono">
                        ID: {token.id.slice(0, 8)}... | 创建: {new Date(token.createdAt).toLocaleString()}
                      </Text>
                      {token.lastUsed && (
                        <div className="text-xs text-gray-500 mt-1">
                          最后使用: {new Date(token.lastUsed).toLocaleString()}
                        </div>
                      )}
                      {/* Token显示区域 */}
                      {isVisible && (
                        <div className="mt-2 p-2 bg-gray-100 rounded font-mono text-xs break-all">
                          <div className="flex items-center justify-between mb-1">
                            <Text strong>Token:</Text>
                            <Button
                              size="small"
                              type="primary"
                              onClick={() => handleCopyTokenFromList(token.token)}
                              icon={<CopyOutlined />}
                            >
                              复制
                            </Button>
                          </div>
                          {token.token}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        size="small"
                        onClick={() => toggleTokenVisibility(token.id)}
                        type={isVisible ? "primary" : "default"}
                        icon={isVisible ? <CheckOutlined /> : <EyeOutlined />}
                      >
                        {isVisible ? "隐藏" : "查看"}
                      </Button>
                      <Button
                        danger
                        size="small"
                        onClick={() => handleDelete(token.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </Space>
        )}
      </div>
    </Card>
  );
};

export default LongTermTokenCard;