/**
 * 管理后台 - 评论管理
 * 路由: /c/comments
 */

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Table, Button, Input, Space, Tag, message, Modal, Select, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';
import {
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  UserOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/types/role';

const { Search } = Input;
const { confirm } = Modal;

/**
 * 评论数据类型
 */
interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  parent_id: number | null;
  content: string;
  status: number;
  is_delete: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  post: {
    id: number;
    title: string | null;
    path: string | null;
  };
  user: {
    id: number;
    nickname: string;
    account: string;
    avatar: string | null;
  };
  parent?: {
    id: number;
    content: string;
    user: {
      nickname: string;
      account: string;
    };
  } | null;
}

/**
 * 从 URL 查询参数中读取状态
 */
function useUrlState() {
  const searchParams = useSearchParams();

  return {
    searchText: searchParams.get('q') || '',
    statusFilter: searchParams.get('status') || 'all',
    current: parseInt(searchParams.get('page') || '1', 10),
    pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
  };
}

/**
 * 查询参数类型定义
 */
interface QueryParams {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

/**
 * 更新 URL 查询参数
 */
function useUpdateUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback((updates: Partial<QueryParams>) => {
    const currentParams: QueryParams = {
      q: searchParams.get('q') || undefined,
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined,
      pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined,
    };

    const mergedParams: QueryParams = {
      ...currentParams,
      ...updates,
    };

    const params = new URLSearchParams();

    if (mergedParams.q && mergedParams.q.trim()) {
      params.set('q', mergedParams.q.trim());
    }

    if (mergedParams.status && mergedParams.status !== 'all') {
      params.set('status', mergedParams.status);
    }

    if (mergedParams.page && mergedParams.page > 1) {
      params.set('page', mergedParams.page.toString());
    }

    if (mergedParams.pageSize && mergedParams.pageSize !== 20) {
      params.set('pageSize', mergedParams.pageSize.toString());
    }

    const newUrl = params.toString() ? `?${params.toString()}` : '';
    router.replace(`${pathname}${newUrl}`, { scroll: false });
  }, [router, pathname, searchParams]);
}

function CommentsPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const urlState = useUrlState();
  const updateUrl = useUpdateUrl();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchInputValue, setSearchInputValue] = useState(urlState.searchText);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableScrollHeight, setTableScrollHeight] = useState<number | undefined>(undefined);

  const pagination = useMemo(() => ({
    current: urlState.current,
    pageSize: urlState.pageSize,
    total: total,
  }), [urlState, total]);

  /**
   * 动态计算表格滚动高度
   */
  useEffect(() => {
    const updateScrollHeight = () => {
      if (tableContainerRef.current) {
        const containerHeight = tableContainerRef.current.clientHeight;
        if (containerHeight > 0) {
          const scrollHeight = containerHeight - 104;
          setTableScrollHeight(Math.max(scrollHeight, 300));
        }
      }
    };

    updateScrollHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateScrollHeight();
    });

    if (tableContainerRef.current) {
      resizeObserver.observe(tableContainerRef.current);
    }

    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateScrollHeight, 100);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, []);

  /**
   * 当 URL 中的搜索关键词变化时，同步搜索框的值
   */
  useEffect(() => {
    setSearchInputValue(urlState.searchText);
  }, [urlState.searchText]);

  /**
   * 加载评论列表
   */
  const loadComments = useCallback(async (pageNum?: number, pageSize?: number) => {
    try {
      setLoading(true);

      const currentPage = pageNum ?? urlState.current;
      const currentPageSize = pageSize ?? urlState.pageSize;

      const params: Record<string, string | number> = {
        pageNum: currentPage,
        pageSize: currentPageSize,
      };

      if (urlState.searchText) {
        params.query = urlState.searchText;
      }

      if (urlState.statusFilter && urlState.statusFilter !== 'all') {
        params.status = urlState.statusFilter;
      }

      const response = await axios.get('/api/comment/list', { params });

      if (response.data.status) {
        const data = response.data.data;
        setComments(data.record || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('加载评论失败:', error);
      message.error('加载评论失败');
    } finally {
      setLoading(false);
    }
  }, [urlState]);

  /**
   * 删除评论
   */
  const handleDelete = (comment: Comment) => {
    confirm({
      title: '确认删除',
      content: `确定要删除这条评论吗？`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await axios.delete(`/api/comment/${comment.id}`);
          if (response.data.status) {
            message.success('删除成功');
            loadComments(urlState.current, urlState.pageSize);
          } else {
            message.error(response.data.message || '删除失败');
          }
        } catch (error) {
          console.error('删除评论失败:', error);
          message.error('删除失败');
        }
      },
    });
  };

  /**
   * 查看文章
   */
  const handleViewPost = (comment: Comment) => {
    if (comment.post.path) {
      window.open(comment.post.path, '_blank');
    } else {
      window.open(`/post/${comment.post.id}`, '_blank');
    }
  };

  /**
   * 查看用户信息
   */
  const handleViewUser = (comment: Comment) => {
    router.push(`/c/user/info?id=${comment.user.id}`);
  };

  /**
   * 统一的查询参数更新方法
   */
  const updateQueryParams = useCallback((updates: Partial<QueryParams>) => {
    updateUrl(updates);
  }, [updateUrl]);

  /**
   * 当 URL 状态变化时，重新加载数据
   */
  useEffect(() => {
    if (user) {
      loadComments(urlState.current, urlState.pageSize);
    }
  }, [user, urlState.current, urlState.pageSize, urlState.statusFilter, urlState.searchText]);

  /**
   * 表格列定义
   */
  const columns: TableColumnsType<Comment> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '评论内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (content: string) => (
        <Tooltip title={content}>
          <div className="max-w-md truncate">{content}</div>
        </Tooltip>
      ),
    },
    {
      title: '评论者',
      key: 'user',
      width: 150,
      render: (_: unknown, record: Comment) => (
        <div className="flex items-center gap-2">
          <Button
            type="link"
            size="small"
            icon={<UserOutlined />}
            onClick={() => handleViewUser(record)}
          >
            {record.user.nickname}
          </Button>
        </div>
      ),
    },
    {
      title: '所属文章',
      key: 'post',
      width: 200,
      ellipsis: true,
      render: (_: unknown, record: Comment) => {
        const title = record.post.title || `文章 #${record.post.id}`;
        return (
          <Tooltip title={title}>
            <Button
              type="link"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => handleViewPost(record)}
              className="truncate"
            >
              {title}
            </Button>
          </Tooltip>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: number) => (
        <Tag color={status === 1 ? 'success' : 'default'}>
          {status === 1 ? '正常' : '隐藏'}
        </Tag>
      ),
    },
    {
      title: '回复',
      key: 'parent',
      width: 200,
      ellipsis: true,
      render: (_: unknown, record: Comment) => {
        if (record.parent) {
          const replyText = `回复 ${record.parent.user.nickname}: ${record.parent.content}`;
          return (
            <Tooltip title={replyText}>
              <div className="truncate text-sm text-gray-500">
                {replyText}
              </div>
            </Tooltip>
          );
        }
        return <span className="text-gray-400">-</span>;
      },
    },
    {
      title: '点赞',
      dataIndex: 'like_count',
      key: 'like_count',
      width: 80,
      render: (count: number) => (
        <span>❤️ {count}</span>
      ),
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: Comment) => (
        <Space wrap>
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

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-6 flex items-center justify-between shrink-0">
          <h1 className="text-2xl font-bold">评论管理</h1>
        </div>

        {/* 搜索和筛选 */}
        <div className="mb-4 flex gap-4 shrink-0">
          <Search
            placeholder="搜索评论内容"
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            value={searchInputValue}
            onSearch={(value) => updateQueryParams({ q: value, page: 1 })}
            onChange={(e) => setSearchInputValue(e.target.value)}
            onPressEnter={(e) => {
              e.preventDefault();
              updateQueryParams({ q: searchInputValue, page: 1 });
            }}
            style={{ maxWidth: 400 }}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            size="large"
            style={{ width: 120 }}
            value={urlState.statusFilter === 'all' ? undefined : urlState.statusFilter}
            onChange={(value) => updateQueryParams({ status: value || 'all', page: 1 })}
            options={[
              { label: '全部', value: 'all' },
              { label: '正常', value: '1' },
              { label: '隐藏', value: '0' },
            ]}
          />
        </div>

        {/* 评论列表 */}
        <div ref={tableContainerRef} className="flex-1 flex flex-col min-h-0">
          <Table
            columns={columns}
            dataSource={comments}
            rowKey="id"
            loading={loading}
            scroll={tableScrollHeight ? { y: tableScrollHeight } : undefined}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showTotal: (total) => `共 ${total} 条评论`,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ['10', '20', '50', '100'],
            }}
            onChange={(paginationConfig) => {
              updateQueryParams({
                page: paginationConfig.current || 1,
                pageSize: paginationConfig.pageSize || 20,
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 默认导出组件，使用 Suspense 包裹以支持 useSearchParams
 */
export default function CommentsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div>加载中...</div>
      </div>
    }>
      <CommentsPageContent />
    </Suspense>
  );
}
