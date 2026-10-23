/**
 * 实体变更历史弹窗组件
 * 通用组件，可用于文章、合集等实体的变更历史查看
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Table, Tag, Space, Spin, Empty, Timeline } from 'antd';
import type { TableColumnsType } from 'antd';
import {
  HistoryOutlined,
  ClockCircleOutlined,
  FieldStringOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { EntityType } from '@/types/entity-change';

/**
 * 变更日志记录类型
 */
interface ChangeLog {
  id: number;
  entityId: number;
  entityType: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  valueType: string;
  createdAt: string;
  createdBy: number | null;
}

/**
 * 组件属性
 */
interface EntityChangeHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  entityType: EntityType;
  entityId: number;
  entityName?: string; // 可选，用于弹窗标题显示
}

/**
 * 值类型标签颜色映射
 */
const valueTypeColorMap: Record<string, string> = {
  string: 'blue',
  number: 'green',
  boolean: 'orange',
  array: 'purple',
  object: 'cyan',
  date: 'magenta',
  null: 'default',
};

/**
 * 字段显示名称映射
 */
const fieldDisplayNameMap: Record<string, string> = {
  title: '标题',
  path: '路径',
  tags: '标签',
  date: '日期',
  cover: '封面',
  description: '描述',
  hide: '隐藏状态',
  is_delete: '删除状态',
  github_url: 'GitHub URL',
  github_repo: 'GitHub 仓库',
  name: '合集名称',
  slug: '合集标识',
  sort_order: '排序',
  status: '状态',
  background: '背景图',
  color: '主题色',
  extends_json: '昼夜视觉配置',
  posts: '关联文章',
};

interface ArticleSnapshot {
  id: number;
  title: string;
  path: string;
}

interface ObjectDiff {
  path: string;
  oldValue: unknown;
  newValue: unknown;
}

const visualPathDisplayNameMap: Record<string, string> = {
  version: '配置版本',
  presentation: '展示主题',
  day: '日间主题',
  night: '夜间主题',
  coverImageUrl: '封面图片',
  coverVideoUrl: '封面视频',
  backgroundImageUrl: '背景图片',
  objectPosition: '焦点位置',
  accentColor: '强调色',
  readingPath: '阅读线索',
};

function parseStructuredValue(value: string | null): unknown {
  if (value === null || value === '') return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function getArticleSnapshots(value: string | null): ArticleSnapshot[] {
  const parsed = parseStructuredValue(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item): ArticleSnapshot[] => {
    if (!item || typeof item !== 'object') return [];
    const article = item as Partial<ArticleSnapshot>;
    if (typeof article.id !== 'number') return [];
    return [{
      id: article.id,
      title: typeof article.title === 'string' ? article.title : `文章 #${article.id}`,
      path: typeof article.path === 'string' ? article.path : '',
    }];
  });
}

function collectObjectDiffs(
  oldValue: unknown,
  newValue: unknown,
  path = '',
): ObjectDiff[] {
  const oldIsObject = oldValue !== null && typeof oldValue === 'object' && !Array.isArray(oldValue);
  const newIsObject = newValue !== null && typeof newValue === 'object' && !Array.isArray(newValue);

  if (oldIsObject || newIsObject) {
    const oldRecord = oldIsObject ? oldValue as Record<string, unknown> : {};
    const newRecord = newIsObject ? newValue as Record<string, unknown> : {};
    const keys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);
    return [...keys].flatMap((key) => collectObjectDiffs(
      oldRecord[key],
      newRecord[key],
      path ? `${path}.${key}` : key,
    ));
  }

  if (oldValue == null && newValue == null) return [];

  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return [];
  } else if (Object.is(oldValue, newValue)) {
    return [];
  }

  return [{ path, oldValue, newValue }];
}

function formatVisualPath(path: string): string {
  return path.split('.').map((part) => visualPathDisplayNameMap[part] || part).join(' / ');
}

function formatDiffValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: '#999' }}>空</span>;
  }
  if (typeof value === 'boolean') {
    return <Tag color={value ? 'success' : 'default'}>{value ? '是' : '否'}</Tag>;
  }
  if (typeof value === 'object') {
    return (
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return (
    <code style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      {String(value)}
    </code>
  );
}

function renderArticleChanges(record: ChangeLog): React.ReactNode {
  const oldArticles = getArticleSnapshots(record.oldValue);
  const newArticles = getArticleSnapshots(record.newValue);
  const oldIds = new Set(oldArticles.map((article) => article.id));
  const newIds = new Set(newArticles.map((article) => article.id));
  const added = newArticles.filter((article) => !oldIds.has(article.id));
  const removed = oldArticles.filter((article) => !newIds.has(article.id));

  const groups = [
    { title: '新增到合集', color: 'green', articles: added },
    { title: '从合集中移除', color: 'red', articles: removed },
  ].filter((group) => group.articles.length > 0);

  return (
    <div style={{ minWidth: 300 }}>
      {groups.length > 0 ? groups.map((group) => (
        <div key={group.title} style={{ marginBottom: 8 }}>
          <Tag color={group.color}>{group.title} · {group.articles.length} 篇</Tag>
          <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
            {group.articles.map((article) => (
              <div key={`${group.title}-${article.id}`}>
                <div>{article.title}</div>
                {article.path && <code style={{ color: '#888', fontSize: 12 }}>{article.path}</code>}
              </div>
            ))}
          </div>
        </div>
      )) : (
        <span style={{ color: '#999' }}>关联文章未新增或移除</span>
      )}
      <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
        变更前 {oldArticles.length} 篇 → 变更后 {newArticles.length} 篇
      </div>
    </div>
  );
}

function renderVisualConfigChanges(record: ChangeLog): React.ReactNode {
  const oldValue = parseStructuredValue(record.oldValue);
  const newValue = parseStructuredValue(record.newValue);
  const changes = collectObjectDiffs(oldValue, newValue);

  if (changes.length === 0) return <span style={{ color: '#999' }}>没有检测到具体字段差异</span>;

  return (
    <div style={{ minWidth: 320, display: 'grid', gap: 10 }}>
      {changes.map((change) => (
        <div key={change.path} style={{ borderBottom: '1px solid #eee', paddingBottom: 8 }}>
          <div style={{ fontSize: 12, color: '#777', marginBottom: 4 }}>
            {formatVisualPath(change.path || '配置整体')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 3 }}>旧值</div>
              {formatDiffValue(change.oldValue)}
            </div>
            <ArrowRightOutlined style={{ color: '#999', marginTop: 18 }} />
            <div>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 3 }}>新值</div>
              {formatDiffValue(change.newValue)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function renderChangeContent(record: ChangeLog): React.ReactNode {
  if (record.fieldName === 'posts') return renderArticleChanges(record);
  if (record.fieldName === 'extends_json' && record.valueType === 'object') {
    return renderVisualConfigChanges(record);
  }

  return (
    <div style={{ minWidth: 300 }}>
      <Space orientation="vertical" style={{ width: '100%' }}>
        <div>
          <div style={{ color: '#999', fontSize: '12px', marginBottom: 4 }}>旧值：</div>
          {formatValue(record.oldValue, record.valueType)}
        </div>
        <ArrowRightOutlined style={{ color: '#999', fontSize: '12px' }} />
        <div>
          <div style={{ color: '#999', fontSize: '12px', marginBottom: 4 }}>新值：</div>
          {formatValue(record.newValue, record.valueType)}
        </div>
      </Space>
    </div>
  );
}

/**
 * 格式化值用于显示
 */
function formatValue(value: string | null, valueType: string): React.ReactNode {
  if (value === null || value === '') {
    return <span style={{ color: '#999' }}>空</span>;
  }

  try {
    switch (valueType) {
      case 'array':
        const arr = JSON.parse(value);
        return Array.isArray(arr) ? (
          <Space wrap>
            {arr.map((item, index) => (
              <Tag key={index} color="blue">
                {String(item)}
              </Tag>
            ))}
          </Space>
        ) : (
          String(value)
        );

      case 'object':
      case 'date':
        const obj = JSON.parse(value);
        return <code style={{ fontSize: '12px' }}>{JSON.stringify(obj, null, 2)}</code>;

      case 'boolean':
        return value === 'true' ? (
          <Tag color="success">是</Tag>
        ) : (
          <Tag color="default">否</Tag>
        );

      default:
        // 截断过长的字符串
        if (value.length > 100) {
          return (
            <span title={value}>
              {value.substring(0, 100)}...
            </span>
          );
        }
        return value;
    }
  } catch {
    return value;
  }
}

/**
 * 主组件
 */
export default function EntityChangeHistoryModal({
  visible,
  onClose,
  entityType,
  entityId,
  entityName,
}: EntityChangeHistoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<ChangeLog[]>([]);
  const [timelineMode, setTimelineMode] = useState(false);

  // 加载变更历史
  const loadChangeHistory = useCallback(async () => {
    if (!visible || !entityId) return;

    setLoading(true);
    try {
      const response = await axios.get(
        `/api/entity-change/${entityType}/${entityId}`
      );

      if (response.data.success) {
        setLogs(response.data.data.logs || []);
      }
    } catch (error) {
      console.error('加载变更历史失败:', error);
    } finally {
      setLoading(false);
    }
  }, [visible, entityId, entityType]);

  useEffect(() => {
    loadChangeHistory();
  }, [loadChangeHistory]);

  // 表格列定义
  const columns: TableColumnsType<ChangeLog> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => (
        <Space>
          <ClockCircleOutlined />
          <span>{dayjs(date).format('YYYY-MM-DD HH:mm:ss')}</span>
        </Space>
      ),
    },
    {
      title: '字段',
      dataIndex: 'fieldName',
      key: 'fieldName',
      width: 120,
      render: (fieldName: string) => (
        <Space>
          <FieldStringOutlined />
          <span>{fieldDisplayNameMap[fieldName] || fieldName}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'valueType',
      key: 'valueType',
      width: 80,
      render: (valueType: string) => (
        <Tag color={valueTypeColorMap[valueType] || 'default'}>
          {valueType}
        </Tag>
      ),
    },
    {
      title: '变更内容',
      key: 'change',
      render: (_: unknown, record: ChangeLog) => (
        renderChangeContent(record)
      ),
    },
  ];

  // 时间轴数据
  const timelineItems = logs.map((log) => ({
    key: log.id,
    dot: <ClockCircleOutlined style={{ fontSize: '16px' }} />,
    children: (
      <div>
        <div style={{ marginBottom: 8 }}>
          <Space>
            <span style={{ fontWeight: 'bold' }}>
              {fieldDisplayNameMap[log.fieldName] || log.fieldName}
            </span>
            <Tag color={valueTypeColorMap[log.valueType] || 'default'}>
              {log.valueType}
            </Tag>
            <span style={{ color: '#999', fontSize: '12px' }}>
              {dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </span>
          </Space>
        </div>
        {renderChangeContent(log)}
      </div>
    ),
  }));

  // 实体类型名称
  const entityTypeName = entityType === EntityType.POST ? '文章' : '合集';

  return (
    <Modal
      title={
        <Space>
          <HistoryOutlined />
          <span>
            {entityTypeName}变更历史
            {entityName && ` - ${entityName}`}
          </span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      footer={null}
      styles={{
        body: { padding: '24px' },
      }}
    >
      <Spin spinning={loading}>
        {logs.length === 0 && !loading ? (
          <Empty description="暂无变更记录" />
        ) : (
          <>
            <Space style={{ marginBottom: 16 }}>
              <span>共 {logs.length} 条变更记录</span>
              <span>|</span>
              <span
                style={{ cursor: 'pointer', color: '#1890ff' }}
                onClick={() => setTimelineMode(!timelineMode)}
              >
                {timelineMode ? '表格视图' : '时间轴视图'}
              </span>
            </Space>

            {timelineMode ? (
              <Timeline items={timelineItems} />
            ) : (
              <Table
                columns={columns}
                dataSource={logs}
                rowKey="id"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                }}
                size="small"
              />
            )}
          </>
        )}
      </Spin>
    </Modal>
  );
}
