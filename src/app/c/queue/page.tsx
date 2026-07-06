/**
 * 后台任务队列监控页面
 * 路由: /c/queue
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  message,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from '@/lib/axios';
import { useAuth } from '@/contexts/AuthContext';
import { QUEUE_VIEW, USER_MANAGE } from '@/constants/permissions';
import { useBreakpoint } from '@/hooks/useBreakpoint';

const { Title, Text } = Typography;

interface EmbeddingQueueStatus {
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

interface ImageQueueTask {
  id: number;
  jobId: string;
  prompt: string;
  source: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

interface ImageQueueMonitor {
  queue: {
    queueLength: number;
    processingCount: number;
    queueTasks: Array<{ id: string; type: string; title?: string; priority: number; addTime: number }>;
    processingTasks: string[];
    isRunning: boolean;
  };
  counts: Record<'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED', number>;
  queueTasks: ImageQueueTask[];
  processingTasks: ImageQueueTask[];
  recentFailedTasks: ImageQueueTask[];
  staleRecovery: {
    recoveredAt: string;
    staleProcessingCount: number;
    requeuedPendingCount: number;
  } | null;
}

interface TtsQueueTask {
  id: number;
  jobId: string;
  type: string;
  prompt: string;
  source: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

interface TtsQueueMonitor {
  queue: {
    queueLength: number;
    processingCount: number;
    queueTasks: Array<{ id: string; type: string; title?: string; priority: number; addTime: number }>;
    processingTasks: string[];
    isRunning: boolean;
  };
  counts: Record<'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED', number>;
  queueTasks: TtsQueueTask[];
  processingTasks: TtsQueueTask[];
  recentFailedTasks: TtsQueueTask[];
  staleRecovery: {
    recoveredAt: string;
    staleProcessingCount: number;
    requeuedPendingCount: number;
  } | null;
}

const EMBED_STATUS_MAP: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待处理' },
  processing: { color: 'processing', text: '处理中' },
  completed: { color: 'success', text: '已完成' },
  failed: { color: 'error', text: '失败' },
};

const IMAGE_STATUS_MAP: Record<ImageQueueTask['status'], { color: string; text: string }> = {
  PENDING: { color: 'default', text: '待处理' },
  PROCESSING: { color: 'processing', text: '处理中' },
  SUCCESS: { color: 'success', text: '成功' },
  FAILED: { color: 'error', text: '失败' },
};

const TTS_STATUS_MAP: Record<TtsQueueTask['status'], { color: string; text: string }> = {
  PENDING: { color: 'default', text: '待处理' },
  PROCESSING: { color: 'processing', text: '处理中' },
  SUCCESS: { color: 'success', text: '成功' },
  FAILED: { color: 'error', text: '失败' },
};

const PRIORITY_MAP: Record<number, { color: string; text: string }> = {
  1: { color: 'error', text: '高' },
  5: { color: 'warning', text: '中' },
  10: { color: 'default', text: '低' },
};

function formatTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function ellipsis(value: string, max = 36) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

export default function QueueMonitorPage() {
  const { user, hasPermission } = useAuth();
  const { isMobile } = useBreakpoint();
  const [loading, setLoading] = useState(false);
  const [embeddingQueue, setEmbeddingQueue] = useState<EmbeddingQueueStatus | null>(null);
  const [imageMonitor, setImageMonitor] = useState<ImageQueueMonitor | null>(null);
  const [ttsMonitor, setTtsMonitor] = useState<TtsQueueMonitor | null>(null);
  const [taskStatuses, setTaskStatuses] = useState<Map<number, EmbedStatus>>(new Map());
  const [deletingImageJobIds, setDeletingImageJobIds] = useState<Set<string>>(new Set());
  const [deletingTtsJobIds, setDeletingTtsJobIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const hasAccess = Boolean(user && hasPermission(QUEUE_VIEW));
  const canDeleteImageLog = Boolean(user && hasPermission(USER_MANAGE));

  const loadEmbeddingTaskStatuses = useCallback(async (taskIds: number[]) => {
    if (taskIds.length === 0 || !hasAccess) {
      setTaskStatuses(new Map());
      return;
    }

    try {
      const results = await Promise.all(
        taskIds.map((id) => axios.get(`/api/post/${id}/embed`).catch(() => null)),
      );

      const statusMap = new Map<number, EmbedStatus>();
      results.forEach((res, index) => {
        if (res?.data?.status) {
          statusMap.set(taskIds[index], res.data.data as EmbedStatus);
        }
      });
      setTaskStatuses(statusMap);
    } catch (requestError) {
      console.error('加载向量任务状态失败:', requestError);
    }
  }, [hasAccess]);

  const loadDashboard = useCallback(async () => {
    if (!hasAccess) return;

    try {
      setLoading(true);
      setError(null);

      const [embeddingRes, imageRes, ttsRes] = await Promise.all([
        axios.get('/api/post/embed/queue'),
        axios.get('/api/image-gen/queue'),
        axios.get('/api/tts/queue'),
      ]);

      if (!embeddingRes.data?.status) {
        throw new Error(embeddingRes.data?.message || '加载向量队列失败');
      }
      if (!imageRes.data?.status) {
        throw new Error(imageRes.data?.message || '加载图片生成队列失败');
      }
      if (!ttsRes.data?.status) {
        throw new Error(ttsRes.data?.message || '加载 TTS 队列失败');
      }

      const embeddingData = embeddingRes.data.data as EmbeddingQueueStatus;
      const imageData = imageRes.data.data as ImageQueueMonitor;
      const ttsData = ttsRes.data.data as TtsQueueMonitor;

      setEmbeddingQueue(embeddingData);
      setImageMonitor(imageData);
      setTtsMonitor(ttsData);

      const allTaskIds = [
        ...embeddingData.queueTasks.map((task) => task.postId),
        ...embeddingData.processingTasks,
      ];
      void loadEmbeddingTaskStatuses(allTaskIds);
    } catch (requestError) {
      console.error('加载队列监控失败:', requestError);
      setError(
        requestError instanceof Error ? requestError.message : '加载队列监控失败',
      );
    } finally {
      setLoading(false);
    }
  }, [hasAccess, loadEmbeddingTaskStatuses]);

  useEffect(() => {
    if (!hasAccess) return;
    void loadDashboard();
    const timer = setInterval(() => {
      void loadDashboard();
    }, 5000);
    return () => clearInterval(timer);
  }, [hasAccess, loadDashboard]);

  const handleRetryImageJob = useCallback(async (jobId: string) => {
    try {
      const response = await axios.post(`/api/image-gen/jobs/${jobId}/retry`);
      if (!response.data?.status) {
        throw new Error(response.data?.message || '重试失败');
      }
      message.success('任务已重新入队');
      await loadDashboard();
    } catch (requestError) {
      console.error('重试图片生成任务失败:', requestError);
      message.error(
        (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (requestError instanceof Error ? requestError.message : '重试失败'),
      );
    }
  }, [loadDashboard]);

  const handleDeleteImageJob = useCallback(async (record: ImageQueueTask) => {
    setDeletingImageJobIds((prev) => new Set(prev).add(record.jobId));
    try {
      const response = await axios.delete(`/api/image-gen/logs/${record.id}`, {
        data: { deleteCos: false },
      });
      if (!response.data?.status) {
        throw new Error(response.data?.message || '删除失败');
      }
      message.success('失败任务已删除');
      await loadDashboard();
    } catch (requestError) {
      console.error('删除图片生成失败任务失败:', requestError);
      message.error(
        (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (requestError instanceof Error ? requestError.message : '删除失败'),
      );
    } finally {
      setDeletingImageJobIds((prev) => {
        const next = new Set(prev);
        next.delete(record.jobId);
        return next;
      });
    }
  }, [loadDashboard]);

  const handleRetryTtsJob = useCallback(async (jobId: string) => {
    try {
      const response = await axios.post(`/api/tts/jobs/${jobId}/retry`);
      if (!response.data?.status) {
        throw new Error(response.data?.message || '重试失败');
      }
      message.success('TTS 任务已重新入队');
      await loadDashboard();
    } catch (requestError) {
      console.error('重试 TTS 任务失败:', requestError);
      message.error(
        (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (requestError instanceof Error ? requestError.message : '重试失败'),
      );
    }
  }, [loadDashboard]);

  const handleDeleteTtsJob = useCallback(async (record: TtsQueueTask) => {
    setDeletingTtsJobIds((prev) => new Set(prev).add(record.jobId));
    try {
      const response = await axios.delete(`/api/tts/logs/${record.id}`, {
        data: { deleteCos: false },
      });
      if (!response.data?.status) {
        throw new Error(response.data?.message || '删除失败');
      }
      message.success('TTS 失败任务已删除');
      await loadDashboard();
    } catch (requestError) {
      console.error('删除 TTS 失败任务失败:', requestError);
      message.error(
        (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (requestError instanceof Error ? requestError.message : '删除失败'),
      );
    } finally {
      setDeletingTtsJobIds((prev) => {
        const next = new Set(prev);
        next.delete(record.jobId);
        return next;
      });
    }
  }, [loadDashboard]);

  if (!hasAccess) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Alert
          title="权限不足"
          description="您没有权限访问此页面。"
          type="error"
          showIcon
        />
      </div>
    );
  }

  const embeddingQueueColumns: TableColumnsType<{ postId: number; title: string; priority: number }> = [
    {
      title: '文章 ID',
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
        const config = PRIORITY_MAP[priority] || PRIORITY_MAP[10];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_, record) => {
        const ragStatus = taskStatuses.get(record.postId)?.ragStatus || 'pending';
        const config = EMBED_STATUS_MAP[ragStatus] || EMBED_STATUS_MAP.pending;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
  ];

  const embeddingProcessingColumns: TableColumnsType<{ postId: number }> = [
    {
      title: '文章 ID',
      dataIndex: 'postId',
      key: 'postId',
      width: 100,
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => {
        const status = taskStatuses.get(record.postId);
        return (
          <Space orientation="vertical" size="small">
            <Tag color="processing">处理中</Tag>
            {status?.ragError ? <Text type="danger">{status.ragError}</Text> : null}
          </Space>
        );
      },
    },
  ];

  const imageQueueColumns: TableColumnsType<ImageQueueTask> = [
    {
      title: '任务 ID',
      dataIndex: 'jobId',
      key: 'jobId',
      width: 220,
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: 'Prompt',
      dataIndex: 'prompt',
      key: 'prompt',
      ellipsis: true,
      render: (value: string) => <span title={value}>{ellipsis(value, 48)}</span>,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (value: string) => <Tag color={value === 'MCP' ? 'purple' : 'blue'}>{value}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ImageQueueTask['status']) => {
        const config = IMAGE_STATUS_MAP[status];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '时间',
      key: 'time',
      width: 180,
      render: (_, record) => formatTime(record.startedAt || record.createdAt),
    },
  ];

  const imageFailedColumns: TableColumnsType<ImageQueueTask> = [
    {
      title: '任务 ID',
      dataIndex: 'jobId',
      key: 'jobId',
      width: 220,
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: 'Prompt',
      dataIndex: 'prompt',
      key: 'prompt',
      ellipsis: true,
      render: (value: string) => <span title={value}>{ellipsis(value, 42)}</span>,
    },
    {
      title: '失败原因',
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      ellipsis: true,
      render: (value: string | null) => value || '-',
    },
    {
      title: '失败时间',
      key: 'finishedAt',
      width: 180,
      render: (_, record) => formatTime(record.finishedAt || record.updatedAt || record.createdAt),
    },
    {
      title: '操作',
      key: 'action',
      width: canDeleteImageLog ? 160 : 100,
      render: (_, record) => (
        <Space size="small">
          <Popconfirm
            title="重新入队该任务？"
            onConfirm={() => void handleRetryImageJob(record.jobId)}
            okText="重试"
            cancelText="取消"
          >
            <Button size="small" variant="link">重试</Button>
          </Popconfirm>
          {canDeleteImageLog ? (
            <Popconfirm
              title="删除该失败任务？"
              description="只删除任务记录，不删除已生成的 COS 文件。"
              onConfirm={() => void handleDeleteImageJob(record)}
              okText="删除"
              cancelText="取消"
            >
              <Button
                size="small"
                variant="link"
                color="danger"
                icon={<DeleteOutlined />}
                loading={deletingImageJobIds.has(record.jobId)}
              >
                删除
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  const ttsQueueColumns: TableColumnsType<TtsQueueTask> = [
    {
      title: '任务 ID',
      dataIndex: 'jobId',
      key: 'jobId',
      width: 220,
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: '文本',
      dataIndex: 'prompt',
      key: 'prompt',
      ellipsis: true,
      render: (value: string) => <span title={value}>{ellipsis(value, 48)}</span>,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (value: string) => <Tag color={value === 'MCP' ? 'purple' : 'blue'}>{value}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: TtsQueueTask['status']) => {
        const config = TTS_STATUS_MAP[status];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '时间',
      key: 'time',
      width: 180,
      render: (_, record) => formatTime(record.startedAt || record.createdAt),
    },
  ];

  const ttsFailedColumns: TableColumnsType<TtsQueueTask> = [
    {
      title: '任务 ID',
      dataIndex: 'jobId',
      key: 'jobId',
      width: 220,
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: '文本',
      dataIndex: 'prompt',
      key: 'prompt',
      ellipsis: true,
      render: (value: string) => <span title={value}>{ellipsis(value, 42)}</span>,
    },
    {
      title: '失败原因',
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      ellipsis: true,
      render: (value: string | null) => value || '-',
    },
    {
      title: '失败时间',
      key: 'finishedAt',
      width: 180,
      render: (_, record) => formatTime(record.finishedAt || record.updatedAt || record.createdAt),
    },
    {
      title: '操作',
      key: 'action',
      width: canDeleteImageLog ? 160 : 100,
      render: (_, record) => (
        <Space size="small">
          <Popconfirm
            title="重新入队该 TTS 任务？"
            onConfirm={() => void handleRetryTtsJob(record.jobId)}
            okText="重试"
            cancelText="取消"
          >
            <Button size="small" variant="link">重试</Button>
          </Popconfirm>
          {canDeleteImageLog ? (
            <Popconfirm
              title="删除该失败任务？"
              description="只删除任务记录，不删除已生成的 COS 文件。"
              onConfirm={() => void handleDeleteTtsJob(record)}
              okText="删除"
              cancelText="取消"
            >
              <Button
                size="small"
                variant="link"
                color="danger"
                icon={<DeleteOutlined />}
                loading={deletingTtsJobIds.has(record.jobId)}
              >
                删除
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  const embedCompletedCount = Array.from(taskStatuses.values()).filter(
    (status) => status.ragStatus === 'completed',
  ).length;
  const embedFailedCount = Array.from(taskStatuses.values()).filter(
    (status) => status.ragStatus === 'failed',
  ).length;

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-6 flex items-center justify-between shrink-0">
          <div>
            <Title level={isMobile ? 4 : 2} className="mb-0">后台任务监控</Title>
            <Text type="secondary">统一查看 embedding、image-gen、TTS 异步任务。</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => void loadDashboard()} loading={loading}>
            刷新
          </Button>
        </div>

        {error ? (
          <Alert
            title="加载失败"
            description={error}
            type="error"
            closable={{ onClose: () => setError(null) }}
            className="mb-4 shrink-0"
          />
        ) : null}

        <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
          <Card title="向量队列总览">
            <Row gutter={16}>
              <Col xs={12} sm={6}>
                <Statistic title="排队中" value={embeddingQueue?.queueLength ?? 0} styles={{ content: { color: '#1677ff' } }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="处理中" value={embeddingQueue?.processingCount ?? 0} styles={{ content: { color: '#faad14' } }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="已完成" value={embedCompletedCount} styles={{ content: { color: '#52c41a' } }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="失败" value={embedFailedCount} styles={{ content: { color: '#ff4d4f' } }} />
              </Col>
            </Row>
          </Card>

          <Card
            title="向量队列详情"
            extra={
              <Tag color={embeddingQueue?.isRunning ? 'success' : 'default'}>
                {embeddingQueue?.isRunning ? '运行中' : '已停止'}
              </Tag>
            }
          >
            <Space orientation="vertical" className="w-full" size="large">
              <div>
                <Title level={5}>等待队列</Title>
                <Table
                  columns={embeddingQueueColumns}
                  dataSource={embeddingQueue?.queueTasks || []}
                  rowKey="postId"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: '当前没有等待中的向量任务' }}
                />
              </div>
              <div>
                <Title level={5}>处理中任务</Title>
                <Table
                  columns={embeddingProcessingColumns}
                  dataSource={(embeddingQueue?.processingTasks || []).map((postId) => ({ postId }))}
                  rowKey="postId"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: '当前没有处理中任务' }}
                />
              </div>
            </Space>
          </Card>

          <Card title="图片生成队列总览">
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <Statistic title="PENDING" value={imageMonitor?.counts.PENDING ?? 0} styles={{ content: { color: '#1677ff' } }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="PROCESSING" value={imageMonitor?.counts.PROCESSING ?? 0} styles={{ content: { color: '#faad14' } }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="SUCCESS" value={imageMonitor?.counts.SUCCESS ?? 0} styles={{ content: { color: '#52c41a' } }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="FAILED" value={imageMonitor?.counts.FAILED ?? 0} styles={{ content: { color: '#ff4d4f' } }} />
              </Col>
            </Row>
            <div className="mt-4">
              <Descriptions size="small" column={isMobile ? 1 : 3} bordered>
                <Descriptions.Item label="内存队列长度">{imageMonitor?.queue.queueLength ?? 0}</Descriptions.Item>
                <Descriptions.Item label="内存处理中">{imageMonitor?.queue.processingCount ?? 0}</Descriptions.Item>
                <Descriptions.Item label="队列状态">
                  <Tag color={imageMonitor?.queue.isRunning ? 'success' : 'default'}>
                    {imageMonitor?.queue.isRunning ? '运行中' : '已停止'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </div>
          </Card>

          <Card title="图片生成队列详情">
            <Space orientation="vertical" className="w-full" size="large">
              <div>
                <Title level={5}>等待队列</Title>
                <Table
                  columns={imageQueueColumns}
                  dataSource={imageMonitor?.queueTasks || []}
                  rowKey="jobId"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: '当前没有等待中的图片生成任务' }}
                />
              </div>
              <div>
                <Title level={5}>处理中任务</Title>
                <Table
                  columns={imageQueueColumns}
                  dataSource={imageMonitor?.processingTasks || []}
                  rowKey="jobId"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: '当前没有处理中图片任务' }}
                />
              </div>
            </Space>
          </Card>

          <Card title="最近失败任务">
            <Table
              columns={imageFailedColumns}
              dataSource={imageMonitor?.recentFailedTasks || []}
              rowKey="jobId"
              pagination={false}
              size="small"
              locale={{ emptyText: '最近没有失败任务' }}
            />
          </Card>

          <Card title="TTS 语音合成队列总览">
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <Statistic title="PENDING" value={ttsMonitor?.counts.PENDING ?? 0} styles={{ content: { color: '#1677ff' } }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="PROCESSING" value={ttsMonitor?.counts.PROCESSING ?? 0} styles={{ content: { color: '#faad14' } }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="SUCCESS" value={ttsMonitor?.counts.SUCCESS ?? 0} styles={{ content: { color: '#52c41a' } }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="FAILED" value={ttsMonitor?.counts.FAILED ?? 0} styles={{ content: { color: '#ff4d4f' } }} />
              </Col>
            </Row>
            <div className="mt-4">
              <Descriptions size="small" column={isMobile ? 1 : 3} bordered>
                <Descriptions.Item label="内存队列长度">{ttsMonitor?.queue.queueLength ?? 0}</Descriptions.Item>
                <Descriptions.Item label="内存处理中">{ttsMonitor?.queue.processingCount ?? 0}</Descriptions.Item>
                <Descriptions.Item label="队列状态">
                  <Tag color={ttsMonitor?.queue.isRunning ? 'success' : 'default'}>
                    {ttsMonitor?.queue.isRunning ? '运行中' : '已停止'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </div>
          </Card>

          <Card title="TTS 队列详情">
            <Space orientation="vertical" className="w-full" size="large">
              <div>
                <Title level={5}>等待队列</Title>
                <Table
                  columns={ttsQueueColumns}
                  dataSource={ttsMonitor?.queueTasks || []}
                  rowKey="jobId"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: '当前没有等待中的 TTS 任务' }}
                />
              </div>
              <div>
                <Title level={5}>处理中任务</Title>
                <Table
                  columns={ttsQueueColumns}
                  dataSource={ttsMonitor?.processingTasks || []}
                  rowKey="jobId"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: '当前没有处理中 TTS 任务' }}
                />
              </div>
            </Space>
          </Card>

          <Card title="TTS 最近失败任务">
            <Table
              columns={ttsFailedColumns}
              dataSource={ttsMonitor?.recentFailedTasks || []}
              rowKey="jobId"
              pagination={false}
              size="small"
              locale={{ emptyText: '最近没有 TTS 失败任务' }}
            />
          </Card>

          <Card title="Stale 恢复结果">
            {imageMonitor?.staleRecovery ? (
              <Descriptions size="small" column={isMobile ? 1 : 3} bordered>
                <Descriptions.Item label="恢复时间">{formatTime(imageMonitor.staleRecovery.recoveredAt)}</Descriptions.Item>
                <Descriptions.Item label="残留 PROCESSING -> FAILED">
                  {imageMonitor.staleRecovery.staleProcessingCount}
                </Descriptions.Item>
                <Descriptions.Item label="重新入队的 PENDING">
                  {imageMonitor.staleRecovery.requeuedPendingCount}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Text type="secondary">当前进程尚未记录恢复快照。</Text>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
