/**
 * 管理后台首页 - 文章管理
 * 路由: /c
 * 对应原版的 /c/index.vue
 */

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Table, Button, Input, Space, Tag, message, Modal, Select, Progress, Dropdown } from 'antd';
import type { TableColumnsType, MenuProps } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  SyncOutlined,
  ReloadOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import type { Post } from '@/types';
import { isAdmin } from '@/types/role';
import { useCachedApi } from '@/hooks/useCachedApi';
import EntityChangeHistoryModal from '@/components/EntityChangeHistoryModal';
import { EntityType } from '@/types/entity-change';

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
    ownerFilter: searchParams.get('owner') || 'mine', // 创建者筛选，默认'mine'（我创建的）
    includeDeleted: searchParams.get('is_delete') === '1', // 是否包含已删除文章（仅管理员）
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
  owner?: string; // 创建者筛选（mine/all）
  is_delete?: string; // 是否包含已删除文章（'0'=未删除，'1'=已删除）
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
    // 获取当前所有查询参数
    const currentParams: QueryParams = {
      q: searchParams.get('q') || undefined,
      hide: searchParams.get('hide') || undefined,
      owner: searchParams.get('owner') || undefined,
      is_delete: searchParams.get('is_delete') || undefined,
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

    // 处理创建者筛选 owner
    if (mergedParams.owner && mergedParams.owner !== 'mine') {
      params.set('owner', mergedParams.owner);
    }

    // 处理是否包含已删除文章 is_delete
    if (mergedParams.is_delete && mergedParams.is_delete === '1') {
      params.set('is_delete', '1');
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
    // 使用当前路径而不是硬编码 /c
    router.replace(`${pathname}${newUrl}`, { scroll: false });
  }, [router, pathname, searchParams]);
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
  // 批量更新向量相关状态
  const [embeddingLoading, setEmbeddingLoading] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState<{
    total: number;
    success: number;
    failed: number;
  } | null>(null);
  // 变更历史弹窗状态
  const [changeHistoryModal, setChangeHistoryModal] = useState<{
    visible: boolean;
    postId: number | null;
    postName: string | null;
  }>({
    visible: false,
    postId: null,
    postName: null,
  });

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
    // 使用 useCallback 稳定函数引用
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

    // 监听窗口大小变化（带节流）
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

  // 登录检查已在布局组件中处理，这里不需要重复检查

  /**
   * 加载文章列表（服务端分页）
   * 优化：添加缓存支持，减少重复请求
   */
  const loadPosts = useCallback(async (pageNum?: number, pageSize?: number) => {
    try {
      setLoading(true);
      interface ListParams {
        pageNum: number;
        pageSize: number;
        hide?: string;
        query?: string;
        created_by?: number;
        is_delete?: number;
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

      // 是否包含已删除文章（仅管理员可查看）
      if (urlState.includeDeleted && isAdmin(user?.role)) {
        params.is_delete = 1;
      }

      // 创建者筛选逻辑
      // 管理员：根据 owner 筛选参数决定（mine/all）
      // 普通用户：强制只能查看自己的文章
      if (user && isAdmin(user.role)) {
        // 管理员可以选择查看全部或自己的文章
        if (urlState.ownerFilter === 'mine') {
          params.created_by = user.id;
        }
        // ownerFilter === 'all' 时不传 created_by，查看所有文章
      } else if (user) {
        // 普通用户只能查看自己的文章
        params.created_by = user.id;
      }

      // 添加缓存控制：使用默认缓存策略（1分钟）
      const response = await axios.get('/api/post/list', {
        params,
      });

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
  }, [urlState, user]); // urlState 已经包含了 ownerFilter，所以不需要额外添加依赖

  /**
   * 删除文章
   * 优化：删除成功后清除缓存，确保数据一致性
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
   * 查看变更历史
   */
  const handleViewChangeHistory = (post: Post) => {
    setChangeHistoryModal({
      visible: true,
      postId: post.id,
      postName: post.title || `文章 #${post.id}`,
    });
  };

  /**
   * 创建新文章
   */
  const handleCreate = () => {
    router.push('/c/edit/new');
  };

  /**
   * 批量更新文章向量
   * 支持三种模式：全部更新 / 只更新失败的文章
   */
  const handleBatchUpdateEmbeddings = (mode: 'all' | 'failed' = 'all') => {
    const isAllMode = mode === 'all';
    const title = isAllMode ? '确认批量更新所有文章' : '确认批量更新失败的文章';
    const content = isAllMode
      ? '确定要更新所有文章的向量数据吗？此操作将把所有文章添加到异步队列中处理。'
      : '确定要更新向量化失败的文章吗？此操作将只把失败的文章添加到异步队列中重新处理。';

    confirm({
      title,
      content,
      okText: '确定',
      okType: 'primary',
      cancelText: '取消',
      onOk: async () => {
        try {
          setEmbeddingLoading(true);
          setEmbeddingProgress({ total: 0, success: 0, failed: 0 });

          const response = await axios.post('/api/post/embed/batch', { mode });

          if (response.data.status) {
            const data = response.data.data;
            setEmbeddingProgress({
              total: data.total,
              success: 0,
              failed: 0,
            });

            message.success(`已将 ${data.total} 篇文章添加到向量化队列`);

            // 3秒后清除进度显示
            setTimeout(() => {
              setEmbeddingProgress(null);
            }, 3000);
          } else {
            message.error(response.data.message || '批量更新失败');
            setEmbeddingProgress(null);
          }
        } catch (error) {
          console.error('批量更新向量失败:', error);
          message.error('批量更新向量失败');
          setEmbeddingProgress(null);
        } finally {
          setEmbeddingLoading(false);
        }
      },
    });
  };

  /**
   * 单篇文章更新向量
   */
  const handleUpdateEmbedding = async (post: Post) => {
    try {
      const response = await axios.post(`/api/post/${post.id}/embed`);

      if (response.data.status) {
        message.success(`《${post.title}》已添加到向量化队列`);
        // 刷新列表
        loadPosts(urlState.current, urlState.pageSize);
      } else {
        message.error(response.data.message || '添加到队列失败');
      }
    } catch (error) {
      console.error('更新向量失败:', error);
      message.error('更新向量失败');
    }
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
  // 只在真正需要重新加载数据时触发
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, urlState.current, urlState.pageSize, urlState.hideFilter, urlState.searchText, urlState.ownerFilter, urlState.includeDeleted]);

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
      title: '向量化状态',
      key: 'rag_status',
      width: 120,
      render: (_: unknown, record: Post) => {
        const ragStatus = record.rag_status || 'pending';
        const statusConfig: Record<string, { color: string; text: string }> = {
          pending: { color: 'default', text: '待处理' },
          processing: { color: 'processing', text: '处理中' },
          completed: { color: 'success', text: '已完成' },
          failed: { color: 'error', text: '失败' },
        };
        const config = statusConfig[ragStatus] || statusConfig.pending;
        return (
          <Tag color={config.color}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '统计',
      key: 'stats',
      width: 150,
      render: (_: unknown, record: Post) => (
        <Space orientation="vertical" size="small">
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
        <Space wrap>
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
            icon={<HistoryOutlined />}
            onClick={() => handleViewChangeHistory(record)}
          >
            变更历史
          </Button>
          <Button
            type="link"
            icon={<ReloadOutlined />}
            onClick={() => handleUpdateEmbedding(record)}
          >
            更新向量
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
    <>
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-6 flex items-center justify-between shrink-0">
          <h1 className="text-2xl font-bold">文章管理</h1>
          <Space>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'all',
                    label: '全部更新',
                    onClick: () => handleBatchUpdateEmbeddings('all'),
                  },
                  {
                    key: 'failed',
                    label: '只更新失败的文章',
                    onClick: () => handleBatchUpdateEmbeddings('failed'),
                  },
                ],
              }}
            >
              <Button
                icon={<SyncOutlined />}
                loading={embeddingLoading}
                size="large"
              >
                批量更新向量
              </Button>
            </Dropdown>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
              size="large"
            >
              创建新文章
            </Button>
          </Space>
        </div>

        {/* 批量更新进度显示 */}
        {embeddingProgress && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-blue-700">批量更新向量进度</span>
              <span className="text-sm text-blue-600">
                成功: {embeddingProgress.success} / 失败: {embeddingProgress.failed} / 总计: {embeddingProgress.total}
              </span>
            </div>
            <Progress
              percent={
                embeddingProgress.total > 0
                  ? Math.round(
                      ((embeddingProgress.success + embeddingProgress.failed) /
                        embeddingProgress.total) *
                        100
                    )
                  : 0
              }
              status={
                embeddingProgress.failed > 0 ? 'exception' : 'success'
              }
              strokeColor={
                embeddingProgress.failed > 0
                  ? '#ff4d4f'
                  : '#52c41a'
              }
            />
          </div>
        )}

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
            onPressEnter={(e) => {
              // 阻止默认的表单提交行为，避免页面刷新
              e.preventDefault();
              updateQueryParams({ q: searchInputValue, page: 1 });
            }}
            style={{ maxWidth: 400 }}
          />
          {/* 创建者筛选 - 仅管理员可见 */}
          {isAdmin(user?.role) && (
            <Select
              placeholder="创建者筛选"
              size="large"
              style={{ width: 120 }}
              value={urlState.ownerFilter}
              onChange={(value) => updateQueryParams({ owner: value || 'mine', page: 1 })}
              options={[
                { label: '我创建的', value: 'mine' },
                { label: '全部', value: 'all' },
              ]}
            />
          )}
          {/* 是否包含已删除 - 仅管理员可见 */}
          {isAdmin(user?.role) && (
            <Select
              placeholder="已删除文章"
              size="large"
              style={{ width: 140 }}
              value={urlState.includeDeleted ? true : undefined}
              onChange={(value) => updateQueryParams({ is_delete: value ? '1' : undefined, page: 1 })}
              options={[
                { label: '仅未删除', value: false },
                { label: '包含已删除', value: true },
              ]}
            />
          )}
          <Select
            placeholder="状态筛选"
            allowClear
            size="large"
            style={{ width: 120 }}
            value={hideFilter === 'all' ? undefined : hideFilter}
            onChange={(value) => updateQueryParams({ hide: value || 'all', page: 1 })}
            options={
              isAdmin(user?.role)
                ? [
                    { label: '全部', value: 'all' },
                    { label: '显示', value: '0' },
                    { label: '隐藏', value: '1' },
                  ]
                : [
                    { label: '显示', value: '0' },
                    { label: '隐藏', value: '1' },
                  ]
            }
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

    {/* 变更历史弹窗 */}
    <EntityChangeHistoryModal
      visible={changeHistoryModal.visible}
      onClose={() =>
        setChangeHistoryModal({
          visible: false,
          postId: null,
          postName: null,
        })
      }
      entityType={EntityType.POST}
      entityId={changeHistoryModal.postId || 0}
      entityName={changeHistoryModal.postName || undefined}
    />
    </>
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

