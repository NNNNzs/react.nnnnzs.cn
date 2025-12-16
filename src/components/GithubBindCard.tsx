/**
 * GitHub 账号绑定卡片组件
 */

'use client';

import React, { useState } from 'react';
import { Card, Button, Space, Typography, Avatar, message } from 'antd';
import { GithubOutlined, LinkOutlined, DisconnectOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

interface GithubBindCardProps {
  /**
   * 是否已绑定
   */
  isBound: boolean;
  
  /**
   * GitHub 用户名
   */
  githubUsername?: string;
  
  /**
   * 绑定状态变化回调
   */
  onStatusChange?: () => void;
}

/**
 * GitHub 账号绑定卡片
 */
export default function GithubBindCard({
  isBound,
  githubUsername,
  onStatusChange,
}: GithubBindCardProps) {
  const [loading, setLoading] = useState(false);
  
  /**
   * 绑定 GitHub 账号
   */
  const handleBind = () => {
    // 重定向到 GitHub OAuth 授权页面
    window.location.href = `/api/github/auth?action=bind&redirect=${encodeURIComponent(window.location.pathname)}`;
  };
  
  /**
   * 解绑 GitHub 账号
   */
  const handleUnbind = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/github/unbind');
      
      if (response.data.status) {
        message.success('解绑成功');
        onStatusChange?.();
      } else {
        message.error(response.data.message || '解绑失败');
      }
    } catch (error) {
      console.error('解绑失败:', error);
      message.error('解绑失败');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card>
      <Space orientation="vertical" size="middle" className="w-full">
        <div className="flex items-center gap-3">
          <Avatar
            size={48}
            icon={<GithubOutlined />}
            className="bg-gray-800"
          />
          <div>
            <Title level={4} style={{ marginBottom: 0 }}>
              GitHub 账号
            </Title>
            <Text type="secondary">
              {isBound ? '已绑定' : '未绑定'}
            </Text>
          </div>
        </div>
        
        {isBound ? (
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <Space orientation="vertical" size="small" className="w-full">
              <Text strong>GitHub 用户名</Text>
              <div className="flex items-center gap-2">
                <GithubOutlined />
                <Text>{githubUsername}</Text>
              </div>
              <Button
                danger
                icon={<DisconnectOutlined />}
                onClick={handleUnbind}
                loading={loading}
                className="mt-2"
              >
                解绑账号
              </Button>
            </Space>
          </div>
        ) : (
          <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <Space orientation="vertical" size="small" className="w-full">
              <Text>绑定 GitHub 账号后可以：</Text>
              <ul className="ml-4 space-y-1">
                <li>
                  <Text type="secondary">• 发表文章评论</Text>
                </li>
                <li>
                  <Text type="secondary">• 参与互动讨论</Text>
                </li>
              </ul>
              <Button
                type="primary"
                icon={<LinkOutlined />}
                onClick={handleBind}
                className="mt-2"
              >
                绑定 GitHub 账号
              </Button>
            </Space>
          </div>
        )}
      </Space>
    </Card>
  );
}
