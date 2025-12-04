/**
 * 管理后台首页 - 文章管理
 * 路由: /c
 * 对应原版的 /c/index.vue
 */

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

/**
 * 从 URL 查询参数中读取状态
 */
function useUrlState() {
  const searchParams = useSearchParams();
  
  return {
    searchText: searchParams.get('q') || '',
    hideFilter: searchParams.get('hide') || 'all',
    current: parseInt(searchParams.get('page') || '1', 10),
    pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
  };
}

/**
 * 查询参数类型定义
 */
interface QueryParams {
  q?: string;
  hide?: string;
  page?: number;
  pageSize?: number;
}

/**
 * 更新 URL 查询参数
 */
function useUpdateUrl() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  return useCallback((updates: Partial<QueryParams>) => {
    // 获取当前所有查询参数
    const currentParams: QueryParams = {
      q: searchParams.get('q') || undefined,
      hide: searchParams.get('hide') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined,
      pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined,
    };
    
    // 合并更新到当前参数
    const mergedParams: QueryParams = {
      ...currentParams,
      ...updates,
    };
    
    // 构建新的 URLSearchParams，只包含非空值
    const params = new URLSearchParams();
    
    // 处理搜索关键词 q
    if (mergedParams.q && mergedParams.q.trim()) {
      params.set('q', mergedParams.q.trim());
    }
    
    // 处理状态筛选 hide
    if (mergedParams.hide && mergedParams.hide !== 'all') {
      params.set('hide', mergedParams.hide);
    }
    
    // 处理页码 page
    if (mergedParams.page && mergedParams.page > 1) {
      params.set('page', mergedParams.page.toString());
    }
    
    // 处理每页数量 pageSize
    if (mergedParams.pageSize && mergedParams.pageSize !== 20) {
      params.set('pageSize', mergedParams.pageSize.toString());
    }
    
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    router.replace(`/c${newUrl}`, { scroll: false });
  }, [router, searchParams]);
}

function AdminPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const urlState = useUrlState();
  const updateUrl = useUpdateUrl();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  // 搜索框的临时输入状态（用于用户输入时显示）
  const [searchInputValue, setSearchInputValue] = useState(urlState.searchText);
  // 表格容器引用，用于动态计算高度
  const tableContainerRef = useRef<HTMLDivElement>(null);
  // 表格滚动高度（基于flex-1容器动态计算，减去分页器高度）
  const [tableScrollHeight, setTableScrollHeight] = useState<number | undefined>(undefined);
  
  // 直接使用 URL 状态，不维护本地 state
  const hideFilter = urlState.hideFilter;
  
  // 使用 useMemo 避免每次渲染都创建新对象
  const pagination = useMemo(() => ({
    current: urlState.current,
    pageSize: urlState.pageSize,
    total: total,
  }), [urlState, total]);
  
  const paginationRef = useRef(pagination);
  
  // 保持 ref 与 pagination 同步
  useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  /**
   * 动态计算表格滚动高度（基于flex-1容器的高度）
   * 高度是动态计算的，基于flex布局的剩余空间
   */
  useEffect(() => {
    const updateScrollHeight = () => {
      if (tableContainerRef.current) {
        const containerHeight = tableContainerRef.current.clientHeight;
        if (containerHeight > 0) {
          // 减去分页器的高度（约64px）和表格头部的高度（约40px）
          // 这样表格内容区域可以正确滚动
          const scrollHeight = containerHeight - 104;
          setTableScrollHeight(Math.max(scrollHeight, 300)); // 最小高度300px
        }
      }
    };

    updateScrollHeight();
    
    // 使用 ResizeObserver 监听容器大小变化（响应flex布局变化）
    const resizeObserver = new ResizeObserver(() => {
      updateScrollHeight();
    });
    
    if (tableContainerRef.current) {
      resizeObserver.observe(tableContainerRef.current);
    }
    
    // 监听窗口大小变化
    window.addEventListener('resize', updateScrollHeight);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScrollHeight);
    };
  }, []);

  /**
   * 当 URL 中的搜索关键词变化时，同步搜索框的值
   */
  useEffect(() => {
    setSearchInputValue(urlState.searchText);
  }, [urlState.searchText]);

  // 登录检查已在布局组件中处理，这里不需要重复检查

  /**
   * 加载文章列表（服务端分页）
   */
  const loadPosts = useCallback(async (pageNum?: number, pageSize?: number) => {
    try {
      setLoading(true);
      interface ListParams {
        pageNum: number;
        pageSize: number;
        hide?: string;
        query?: string;
      }

      // 使用传入的参数，如果没有则使用当前 URL 状态
      const currentPage = pageNum ?? urlState.current;
      const currentPageSize = pageSize ?? urlState.pageSize;

      const params: ListParams = {
        pageNum: currentPage,
        pageSize: currentPageSize,
      };

      if (urlState.hideFilter && urlState.hideFilter !== 'all') {
        params.hide = urlState.hideFilter;
      }

      // 如果有搜索关键词，也传给服务端
      if (urlState.searchText) {
        params.query = urlState.searchText;
      }

      const response = await axios.get('/api/post/list', { params });

      if (response.data.status) {
        const data = response.data.data;
        setPosts(data.record || []);
        // 更新总数
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('加载文章失败:', error);
      message.error('加载文章失败');
    } finally {
      setLoading(false);
    }
  }, [urlState]);

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
            // 删除后重新加载当前页数据（使用 URL 状态）
            loadPosts(urlState.current, urlState.pageSize);
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
   * 统一的查询参数更新方法
   * @param updates - 要更新的查询参数部分对象
   */
  const updateQueryParams = useCallback((updates: Partial<QueryParams>) => {
    updateUrl(updates);
  }, [updateUrl]);

  /**
   * 当 URL 状态变化时（包括浏览器返回），重新加载数据
   */
  useEffect(() => {
    if (user) {
      loadPosts(urlState.current, urlState.pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, urlState.current, urlState.pageSize, urlState.hideFilter, urlState.searchText]);

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
      render: (tags: string[] | null) =>
        Array.isArray(tags) && tags.length > 0 ? (
          <Space wrap>
            {tags.map((tag, index) => (
              <Tag key={index} color="blue">
                {tag}
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

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-6 flex items-center justify-between shrink-0">
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
        <div className="mb-4 flex gap-4 shrink-0">
          <Search
            placeholder="搜索标题或内容"
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            value={searchInputValue}
            onSearch={(value) => updateQueryParams({ q: value, page: 1 })}
            onChange={(e) => setSearchInputValue(e.target.value)}
            style={{ maxWidth: 400 }}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            size="large"
            style={{ width: 120 }}
            value={hideFilter === 'all' ? undefined : hideFilter}
            onChange={(value) => updateQueryParams({ hide: value || 'all', page: 1 })}
            options={[
              { label: '全部', value: 'all' },
              { label: '显示', value: '0' },
              { label: '隐藏', value: '1' },
            ]}
          />
        </div>

        {/* 文章列表 - 使用flex-1占据剩余空间，高度动态计算 */}
        <div ref={tableContainerRef} className="flex-1 flex flex-col min-h-0">
          <Table
            columns={columns}
            dataSource={posts}
            rowKey="id"
            loading={loading}
            scroll={tableScrollHeight ? { y: tableScrollHeight } : undefined}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showTotal: (total) => `共 ${total} 篇文章`,
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
export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div>加载中...</div>
      </div>
    }>
      <AdminPageContent />
    </Suspense>
  );
}

