/**
 * 管理后台首页 - 文章管理
 * 路由: /c
 * 对应原版的 /c/index.vue
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Table, Button, Input, Space, Tag, message, Modal, Select } from 'antd';
import type { TableColumnsType } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import type { Post } from '@/types';

const { Search } = Input;
const { confirm } = Modal;

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [hideFilter, setHideFilter] = useState<string>('');

  /**
   * 检查登录状态
   */
  useEffect(() => {
    if (!user) {
      message.warning('请先登录');
      router.push('/login');
    }
  }, [user, router]);

  /**
   * 加载文章列表
   */
  const loadPosts = async () => {
    try {
      setLoading(true);
      interface ListParams {
        pageNum: number;
        pageSize: number;
        hide?: string;
      }

      const params: ListParams = {
        pageNum: 1,
        pageSize: 100,
      };
      
      if (hideFilter) {
        params.hide = hideFilter;
      }

      const response = await axios.get('/api/post/list', { params });
      
      if (response.data.status) {
        let list = response.data.data.record;
        
        // 客户端搜索过滤
        if (searchText) {
          list = list.filter((post: Post) =>
            post.title?.toLowerCase().includes(searchText.toLowerCase()) ||
            post.content?.toLowerCase().includes(searchText.toLowerCase())
          );
        }
        
        setPosts(list);
      }
    } catch (error) {
      console.error('加载文章失败:', error);
      message.error('加载文章失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 删除文章
   */
  const handleDelete = (post: Post) => {
    confirm({
      title: '确认删除',
      content: `确定要删除文章《${post.title}》吗？`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await axios.delete(`/api/post/${post.id}`);
          if (response.data.status) {
            message.success('删除成功');
            loadPosts();
          } else {
            message.error(response.data.message || '删除失败');
          }
        } catch (error) {
          console.error('删除文章失败:', error);
          message.error('删除失败');
        }
      },
    });
  };

  /**
   * 查看文章
   */
  const handleView = (post: Post) => {
    if (post.path) {
      window.open(post.path, '_blank');
    } else {
      window.open(`/post/${post.id}`, '_blank');
    }
  };

  /**
   * 编辑文章
   */
  const handleEdit = (post: Post) => {
    router.push(`/c/edit/${post.id}`);
  };

  /**
   * 创建新文章
   */
  const handleCreate = () => {
    router.push('/c/edit/new');
  };

  /**
   * 搜索
   */
  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  useEffect(() => {
    if (user) {
      loadPosts();
    }
  }, [user, searchText, hideFilter]);

  /**
   * 表格列定义
   */
  const columns: TableColumnsType<Post> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      render: (tags: string) =>
        tags ? (
          <Space wrap>
            {tags.split(',').map((tag, index) => (
              <Tag key={index} color="blue">
                {tag.trim()}
              </Tag>
            ))}
          </Space>
        ) : null,
    },
    {
      title: '状态',
      dataIndex: 'hide',
      key: 'hide',
      width: 80,
      render: (hide: string) => (
        <Tag color={hide === '0' ? 'success' : 'default'}>
          {hide === '0' ? '显示' : '隐藏'}
        </Tag>
      ),
    },
    {
      title: '统计',
      key: 'stats',
      width: 150,
      render: (_: unknown, record: Post) => (
        <Space direction="vertical" size="small">
          <span>👁️ {record.visitors || 0}</span>
          <span>❤️ {record.likes || 0}</span>
        </Space>
      ),
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: Post) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">文章管理</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          size="large"
        >
          创建新文章
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <div className="mb-4 flex gap-4">
        <Search
          placeholder="搜索标题或内容"
          allowClear
          enterButton={<SearchOutlined />}
          size="large"
          onSearch={handleSearch}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ maxWidth: 400 }}
        />
        <Select
          placeholder="状态筛选"
          allowClear
          size="large"
          style={{ width: 120 }}
          onChange={(value) => setHideFilter(value || '')}
          options={[
            { label: '显示', value: '0' },
            { label: '隐藏', value: '1' },
          ]}
        />
      </div>

      {/* 文章列表 */}
      <Table
        columns={columns}
        dataSource={posts}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 20,
          showTotal: (total) => `共 ${total} 篇文章`,
        }}
      />
    </div>
  );
}

