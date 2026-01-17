/**
 * 向量化队列监控页面
 * 路由: /c/queue
 * 仅管理员可访问
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Tag, Space, Statistic, Row, Col, Progress, Alert, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/types/role';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;

interface QueueStatus {
  queueLength: number;
  processingCount: number;
  queueTasks: Array<{ postId: number; title: string; priority: number }>;
  processingTasks: number[];
  isRunning: boolean;
}

interface EmbedStatus {
  postId: number;
  ragStatus: string;
  ragError?: string | null;
  ragUpdatedAt?: string | null;
}

export default function QueueMonitorPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [taskStatuses, setTaskStatuses] = useState<Map<number, EmbedStatus>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // 权限检查
  if (!user || !isAdmin(user.role)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Alert
          message="权限不足"
          description="您没有权限访问此页面，仅管理员可访问。"
          type="error"
          showIcon
        />
      </div>
    );
  }

  /**
   * 加载队列状态
   */
  const loadQueueStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get('/api/post/embed/queue');
      if (response.data.status) {
        setQueueStatus(response.data.data);
      } else {
        setError(response.data.message || '加载失败');
      }
    } catch (err) {
      console.error('加载队列状态失败:', err);
      setError('加载队列状态失败');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 加载任务状态
   */
  const loadTaskStatuses = useCallback(async (taskIds: number[]) => {
    if (taskIds.length === 0) return;

    try {
      const promises = taskIds.map(id =>
        axios.get(`/api/post/${id}/embed`).catch(() => null)
      );

      const results = await Promise.all(promises);
      const statusMap = new Map<number, EmbedStatus>();

      results.forEach((res, index) => {
        if (res?.data?.status) {
          statusMap.set(taskIds[index], res.data.data);
        }
      });

      setTaskStatuses(statusMap);
    } catch (err) {
      console.error('加载任务状态失败:', err);
    }
  }, []);

  /**
   * 刷新所有数据
   */
  const handleRefresh = () => {
    loadQueueStatus();
  };

  /**
   * 自动刷新
   */
  useEffect(() => {
    loadQueueStatus();
    const interval = setInterval(loadQueueStatus, 5000); // 每5秒刷新
    return () => clearInterval(interval);
  }, [loadQueueStatus]);

  /**
   * 加载任务详情
   */
  useEffect(() => {
    if (queueStatus) {
      const allTaskIds = [
        ...queueStatus.queueTasks.map(t => t.postId),
        ...queueStatus.processingTasks,
      ];
      loadTaskStatuses(allTaskIds);
    }
  }, [queueStatus, loadTaskStatuses]);

  /**
   * 队列任务表格列定义
   */
  const queueColumns: TableColumnsType<{ postId: number; title: string; priority: number }> = [
    {
      title: '文章ID',
      dataIndex: 'postId',
      key: 'postId',
      width: 100,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: number) => {
        const priorityConfig: Record<number, { color: string; text: string }> = {
          1: { color: 'error', text: '高' },
          5: { color: 'warning', text: '中' },
          10: { color: 'default', text: '低' },
        };
        const config = priorityConfig[priority] || priorityConfig[10];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_, record) => {
        const status = taskStatuses.get(record.postId);
        const ragStatus = status?.ragStatus || 'pending';
        const statusConfig: Record<string, { color: string; text: string }> = {
          pending: { color: 'default', text: '待处理' },
          processing: { color: 'processing', text: '处理中' },
          completed: { color: 'success', text: '已完成' },
          failed: { color: 'error', text: '失败' },
        };
        const config = statusConfig[ragStatus] || statusConfig.pending;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
  ];

  /**
   * 处理中任务表格列定义
   */
  const processingColumns: TableColumnsType<{ postId: number }> = [
    {
      title: '文章ID',
      dataIndex: 'postId',
      key: 'postId',
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => {
        const status = taskStatuses.get(record.postId);
        const ragStatus = status?.ragStatus || 'processing';
        const ragError = status?.ragError;

        return (
          <Space direction="vertical" size="small">
            <Tag color="processing" icon={<span className="loading-dots">●</span>}>
              处理中
            </Tag>
            {ragError && <Text type="danger" style={{ fontSize: 12 }}>{ragError}</Text>}
          </Space>
        );
      },
    },
  ];

  if (!queueStatus) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div>加载中...</div>
      </div>
    );
  }

  const completedCount = Array.from(taskStatuses.values()).filter(
    s => s.ragStatus === 'completed'
  ).length;
  const failedCount = Array.from(taskStatuses.values()).filter(
    s => s.ragStatus === 'failed'
  ).length;

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        {/* 页面标题 */}
        <div className="mb-6 flex items-center justify-between shrink-0">
          <div>
            <Title level={2} className="mb-0">向量化队列监控</Title>
            <Text type="secondary">实时监控文章向量化处理进度</Text>
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
          >
            刷新
          </Button>
        </div>

        {/* 错误提示 */}
        {error && (
          <Alert
            message="错误"
            description={error}
            type="error"
            closable
            className="mb-4 shrink-0"
            onClose={() => setError(null)}
          />
        )}

        {/* 统计卡片 */}
        <Row gutter={16} className="mb-6 shrink-0">
          <Col span={6}>
            <Card>
              <Statistic
                title="队列中"
                value={queueStatus.queueLength}
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="处理中"
                value={queueStatus.processingCount}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已完成"
                value={completedCount}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="失败"
                value={failedCount}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 滚动内容区 */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* 队列状态 */}
          <Card
            title="等待队列"
            className="mb-6"
            extra={
              <Tag color={queueStatus.isRunning ? 'success' : 'default'}>
                {queueStatus.isRunning ? '运行中' : '已停止'}
              </Tag>
            }
          >
            {queueStatus.queueTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-400">队列为空</div>
            ) : (
              <Table
                columns={queueColumns}
                dataSource={queueStatus.queueTasks}
                rowKey="postId"
                pagination={false}
                size="small"
                scroll={{ y: 300 }}
              />
            )}
          </Card>

          {/* 处理中任务 */}
          <Card
            title="处理中任务"
            className="mb-6"
          >
            {queueStatus.processingTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-400">没有正在处理的任务</div>
            ) : (
              <Table
                columns={processingColumns}
                dataSource={queueStatus.processingTasks.map(id => ({ postId: id }))}
                rowKey="postId"
                pagination={false}
                size="small"
              />
            )}
          </Card>

          {/* 提示信息 */}
          <Card type="inner" title="说明">
            <Space direction="vertical" className="w-full">
              <Text>• 队列每 5 秒自动刷新一次</Text>
              <Text>• 点击"刷新"按钮可立即刷新状态</Text>
              <Text>• 优先级：手动触发（高） {'>'} 新建/更新（中） {'>'} 批量更新（低）</Text>
              <Text>• 失败的任务会自动重试，最多 2 次</Text>
            </Space>
          </Card>
        </div>
      </div>
    </div>
  );
}
