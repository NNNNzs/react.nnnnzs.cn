/**
 * OAuth Token管理卡片组件
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Button,
  message,
  Space,
  Typography,
  Divider,
  Alert,
  Tag,
  Modal,
  Tooltip,
} from "antd";
import {
  SafetyOutlined,
  CopyOutlined,
  CheckOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";

const { Title, Text } = Typography;

interface OAuthTokenCardProps {
  userId?: string;
}

interface OAuthTokenItem {
  token: string;
  client_id: string;
  scope: string;
  created_at: number;
  expires_at: number | null;
  is_permanent: boolean;
  duration: number | null;
}

const OAuthTokenCard: React.FC<OAuthTokenCardProps> = ({ userId }) => {
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState<OAuthTokenItem[]>([]);
  const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());

  // 加载token列表
  const loadTokens = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/user/token/oauth");
      if (response.data.status) {
        setTokens(response.data.data);
      } else {
        message.error(response.data.message || "加载失败");
      }
    } catch (error) {
      console.error("加载OAuth Token列表失败:", error);
      message.error("加载OAuth Token列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // 组件挂载时加载token列表
  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  // 切换Token显示/隐藏
  const toggleTokenVisibility = (token: string) => {
    const newVisible = new Set(visibleTokens);
    if (newVisible.has(token)) {
      newVisible.delete(token);
    } else {
      newVisible.add(token);
    }
    setVisibleTokens(newVisible);
  };

  // 复制Token
  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      message.success("Token已复制到剪贴板");
    } catch (error) {
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

  // 删除Token
  const handleDelete = useCallback(async (token: string) => {
    Modal.confirm({
      title: "确认删除",
      content: "确定要删除这个OAuth Token吗？删除后对应的应用将无法继续使用此Token访问您的账户。",
      icon: <ExclamationCircleOutlined />,
      okText: "确认",
      cancelText: "取消",
      onOk: async () => {
        try {
          const response = await axios.delete(
            `/api/user/token/oauth?token=${encodeURIComponent(token)}`
          );
          if (response.data.status) {
            message.success("删除成功");
            loadTokens();
          } else {
            message.error(response.data.message || "删除失败");
          }
        } catch (error) {
          console.error("删除OAuth Token失败:", error);
          message.error("删除失败");
        }
      },
    });
  }, [loadTokens]);

  // 获取过期时间显示
  const getExpiryText = (expires_at: number | null, is_permanent: boolean) => {
    if (is_permanent) {
      return <Tag color="blue">永久有效</Tag>;
    }
    
    if (!expires_at) {
      return <Tag color="default">未知</Tag>;
    }

    const expiry = new Date(expires_at * 1000);
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

  // 获取有效期标签
  const getDurationLabel = (duration: number | null, is_permanent: boolean) => {
    if (is_permanent) return "永久";
    if (duration === null) return "未知";
    if (duration === 0) return "永久";
    return `${duration}天`;
  };

  return (
    <Card
      title={
        <Space>
          <SafetyOutlined />
          <span>OAuth授权管理</span>
        </Space>
      }
      loading={loading}
    >
      {/* 说明提示 */}
      <Alert
        message="OAuth Token说明"
        description="OAuth Token是您授权给第三方应用访问您账户的凭证。您可以查看所有已授权的Token，并在需要时撤销授权。"
        type="info"
        showIcon
        className="mb-4"
      />

      {/* Token列表 */}
      <div>
        <Title level={5} style={{ marginBottom: 12 }}>
          已授权的应用 ({tokens.length})
        </Title>

        {tokens.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <SafetyOutlined style={{ fontSize: 48, marginBottom: 8 }} />
            <div>暂无OAuth授权</div>
            <div className="text-sm mt-2">当您授权第三方应用时，授权信息将显示在这里</div>
          </div>
        ) : (
          <Space direction="vertical" className="w-full" size="middle">
            {tokens.map((tokenItem) => {
              const isVisible = visibleTokens.has(tokenItem.token);
              return (
                <div
                  key={tokenItem.token}
                  className="p-3 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Text strong>客户端: {tokenItem.client_id}</Text>
                        {getExpiryText(tokenItem.expires_at, tokenItem.is_permanent)}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Tag color="purple">权限: {tokenItem.scope}</Tag>
                        <Tag>
                          <ClockCircleOutlined /> {getDurationLabel(tokenItem.duration, tokenItem.is_permanent)}
                        </Tag>
                      </div>
                      <Text type="secondary" className="text-xs">
                        创建时间: {new Date(tokenItem.created_at).toLocaleString()}
                      </Text>
                      {/* Token显示区域 */}
                      {isVisible && (
                        <div className="mt-2 p-2 bg-gray-100 rounded font-mono text-xs break-all">
                          <div className="flex items-center justify-between mb-1">
                            <Text strong>Token:</Text>
                            <Button
                              size="small"
                              type="primary"
                              onClick={() => handleCopyToken(tokenItem.token)}
                              icon={<CopyOutlined />}
                            >
                              复制
                            </Button>
                          </div>
                          {tokenItem.token}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Tooltip title={isVisible ? "隐藏Token" : "查看Token"}>
                        <Button
                          size="small"
                          onClick={() => toggleTokenVisibility(tokenItem.token)}
                          type={isVisible ? "primary" : "default"}
                          icon={isVisible ? <CheckOutlined /> : <EyeOutlined />}
                        >
                          {isVisible ? "隐藏" : "查看"}
                        </Button>
                      </Tooltip>
                      <Tooltip title="撤销授权">
                        <Button
                          danger
                          size="small"
                          onClick={() => handleDelete(tokenItem.token)}
                          icon={<DeleteOutlined />}
                        >
                          撤销
                        </Button>
                      </Tooltip>
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

export default OAuthTokenCard;
