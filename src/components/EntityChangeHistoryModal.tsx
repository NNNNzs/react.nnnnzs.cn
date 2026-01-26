/**
 * 实体变更历史弹窗组件
 * 通用组件，可用于文章、合集等实体的变更历史查看
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Table, Tag, Space, Spin, Empty, Timeline } from 'antd';
import type { TableColumnsType } from 'antd';
import {
  HistoryOutlined,
  ClockCircleOutlined,
  UserOutlined,
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
};

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
  } catch (error) {
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
  const loadChangeHistory = async () => {
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
  };

  useEffect(() => {
    loadChangeHistory();
  }, [visible, entityType, entityId]);

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
        <div style={{ minWidth: 300 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <div style={{ color: '#999', fontSize: '12px', marginBottom: 4 }}>
                旧值：
              </div>
              {formatValue(record.oldValue, record.valueType)}
            </div>
            <ArrowRightOutlined style={{ color: '#999', fontSize: '12px' }} />
            <div>
              <div style={{ color: '#999', fontSize: '12px', marginBottom: 4 }}>
                新值：
              </div>
              {formatValue(record.newValue, record.valueType)}
            </div>
          </Space>
        </div>
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
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <span style={{ color: '#999', fontSize: '12px' }}>旧值： </span>
            {formatValue(log.oldValue, log.valueType)}
          </div>
          <div>
            <span style={{ color: '#999', fontSize: '12px' }}>新值： </span>
            {formatValue(log.newValue, log.valueType)}
          </div>
        </Space>
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
