/**
 * 合集管理页面
 * 路由: /c/collections
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Table, Button, Space, Tag, message, Modal, Switch } from 'antd';
import type { TableColumnsType } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import type { SerializedCollection } from '@/dto/collection.dto';
import { isAdmin } from '@/types/role';
import EntityChangeHistoryModal from '@/components/EntityChangeHistoryModal';
import { EntityType } from '@/types/entity-change';

const { confirm } = Modal;

export default function CollectionsManagePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [collections, setCollections] = useState<SerializedCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  // 变更历史弹窗状态
  const [changeHistoryModal, setChangeHistoryModal] = useState<{
    visible: boolean;
    collectionId: number | null;
    collectionName: string | null;
  }>({
    visible: false,
    collectionId: null,
    collectionName: null,
  });

  // 权限检查
  useEffect(() => {
    if (user && !isAdmin(user.role)) {
      message.error('无权限访问合集管理');
      router.push('/c/post');
    }
  }, [user, router]);

  // 加载合集列表
  const loadCollections = useCallback(async (page = 1, pageSize = 20) => {
    if (!user) {
      message.warning('请先登录');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get('/api/collections', {
        params: {
          pageNum: page,
          pageSize,
          status: 'all', // 获取所有状态的合集，包括隐藏的
        },
      });

      if (res.data.status) {
        setCollections(res.data.data.record);
        setPagination({
          current: res.data.data.pageNum,
          pageSize: res.data.data.pageSize,
          total: res.data.data.total,
        });
      } else {
        message.error('获取合集列表失败');
      }
    } catch (error) {
      console.error('获取合集列表失败:', error);
      message.error('获取合集列表失败');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadCollections();
    }
  }, [user, loadCollections]);

  // 删除合集
  const handleDelete = async (id: number, title: string) => {
    confirm({
      title: '确认删除',
      content: `确定要删除合集「${title}」吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await axios.delete(`/api/collection/${id}`);

          if (res.data.status) {
            message.success('删除成功');
            loadCollections(pagination.current, pagination.pageSize);
          } else {
            message.error(res.data.message || '删除失败');
          }
        } catch (error) {
          console.error('删除合集失败:', error);
          message.error('删除合集失败');
        }
      },
    });
  };

  // 查看变更历史
  const handleViewChangeHistory = (collection: SerializedCollection) => {
    setChangeHistoryModal({
      visible: true,
      collectionId: collection.id,
      collectionName: collection.title || `合集 #${collection.id}`,
    });
  };

  // 切换状态
  const handleToggleStatus = async (id: number, status: number) => {
    try {
      const res = await axios.put(`/api/collection/${id}`, {
        status: status === 1 ? '1' : '0', // 传递字符串而不是数字
      });

      if (res.data.status) {
        message.success('状态更新成功');
        loadCollections(pagination.current, pagination.pageSize);
      } else {
        message.error(res.data.message || '状态更新失败');
      }
    } catch (error) {
      console.error('更新状态失败:', error);
      message.error('更新状态失败');
    }
  };

  // 表格列定义
  const columns: TableColumnsType<SerializedCollection> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '封面',
      dataIndex: 'cover',
      key: 'cover',
      width: 100,
      render: (cover: string) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover || 'https://via.placeholder.com/60x40'}
          alt="封面"
          className="w-16 h-10 object-cover rounded"
        />
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string, record) => (
        <a
          href={`/collections/${record.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {title}
        </a>
      ),
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      key: 'slug',
      width: 150,
      ellipsis: true,
    },
    {
      title: '文章数',
      dataIndex: 'article_count',
      key: 'article_count',
      width: 100,
      render: (count: number) => <Tag color="blue">{count}</Tag>,
    },
    {
      title: '浏览量',
      dataIndex: 'total_views',
      key: 'total_views',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: number, record) => (
        <Switch
          checked={status === 1}
          onChange={() => handleToggleStatus(record.id, status)}
          checkedChildren="显示"
          unCheckedChildren="隐藏"
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => router.push(`/c/collections/${record.id}`)}
          >
            编辑
          </Button>
          <Button
            type="link"
            icon={<HistoryOutlined />}
            onClick={() => handleViewChangeHistory(record)}
          >
            变更历史
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id, record.title)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        {/* 头部操作栏 */}
        <div className="mb-6 flex items-center justify-between shrink-0">
          <h1 className="text-2xl font-bold">合集管理</h1>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push('/c/collections/new')}
            size="large"
          >
            创建合集
          </Button>
        </div>

        {/* 表格容器 - 使用flex-1占据剩余空间 */}
        <div className="flex-1 min-h-0">
          <Table
            columns={columns}
            dataSource={collections}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page, pageSize) => {
                loadCollections(page, pageSize);
              },
            }}
            scroll={{ y: 'calc(100vh - var(--header-height) - 300px)' }}
          />
        </div>
      </div>
    </div>

    {/* 变更历史弹窗 */}
    <EntityChangeHistoryModal
      visible={changeHistoryModal.visible}
      onClose={() =>
        setChangeHistoryModal({
          visible: false,
          collectionId: null,
          collectionName: null,
        })
      }
      entityType={EntityType.COLLECTION}
      entityId={changeHistoryModal.collectionId || 0}
      entityName={changeHistoryModal.collectionName || undefined}
    />
    </>
  );
}
