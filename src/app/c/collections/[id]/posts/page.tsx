/** 合集文章管理页：服务端搜索、分页、关联维护和排序。 */

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Button, Card, Empty, Input, Pagination, Space, Spin, Tag,  } from 'antd';
import { message } from "@/components/AntdAppFeedbackBridge";
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  SaveOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import type { SerializedCollection } from '@/dto/collection.dto';
import type { SerializedPost } from '@/dto/post.dto';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

const { Search } = Input;
const CANDIDATE_PAGE_SIZE = 10;

interface ArticleInCollection extends SerializedPost {
  sort_order: number;
}

interface PostListResponse {
  record: SerializedPost[];
  total: number;
}

export default function CollectionPostsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { isMobile } = useBreakpoint();
  const collectionId = String(params.id || '');

  const [collection, setCollection] = useState<SerializedCollection | null>(null);
  const [selectedArticles, setSelectedArticles] = useState<ArticleInCollection[]>([]);
  const [candidateArticles, setCandidateArticles] = useState<SerializedPost[]>([]);
  const [candidateTotal, setCandidateTotal] = useState(0);
  const [candidatePage, setCandidatePage] = useState(1);
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [pendingPostId, setPendingPostId] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);

  const selectedArticleIds = useMemo(
    () => new Set(selectedArticles.map((article) => article.id)),
    [selectedArticles],
  );

  const loadSelectedArticles = useCallback(async () => {
    const response = await axios.get(`/api/collection/${collectionId}/posts`);
    if (!response.data.status) {
      throw new Error(response.data.message || '获取合集文章失败');
    }
    setSelectedArticles(response.data.data.articles || []);
    setOrderDirty(false);
  }, [collectionId]);

  const loadCollection = useCallback(async () => {
    const response = await axios.get(`/api/collection/${collectionId}`);
    if (!response.data.status) {
      throw new Error(response.data.message || '获取合集信息失败');
    }
    setCollection(response.data.data as SerializedCollection);
  }, [collectionId]);

  const loadCandidates = useCallback(async (page: number, query: string) => {
    setCandidateLoading(true);
    try {
      const response = await axios.get('/api/post/list', {
        params: {
          pageNum: page,
          pageSize: CANDIDATE_PAGE_SIZE,
          hide: '0',
          ...(query ? { query } : {}),
        },
      });
      if (!response.data.status) {
        throw new Error(response.data.message || '获取文章列表失败');
      }

      const data = response.data.data as PostListResponse;
      setCandidateArticles(data.record || []);
      setCandidateTotal(data.total || 0);
    } catch (error) {
      console.error('获取可添加文章失败:', error);
      message.error(error instanceof Error ? error.message : '获取可添加文章失败');
      setCandidateArticles([]);
      setCandidateTotal(0);
    } finally {
      setCandidateLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!collectionId || !user) return;

    const loadInitialData = async () => {
      setInitialLoading(true);
      try {
        await Promise.all([loadCollection(), loadSelectedArticles()]);
      } catch (error) {
        console.error('加载合集文章管理数据失败:', error);
        message.error(error instanceof Error ? error.message : '加载数据失败');
      } finally {
        setInitialLoading(false);
      }
    };

    void loadInitialData();
  }, [collectionId, loadCollection, loadSelectedArticles, user]);

  useEffect(() => {
    if (!user) return;
    void loadCandidates(candidatePage, searchQuery);
  }, [candidatePage, loadCandidates, searchQuery, user]);

  const handleSearch = (value: string) => {
    setSearchInputValue(value);
    setSearchQuery(value.trim());
    setCandidatePage(1);
  };

  const handleAdd = async (post: SerializedPost) => {
    if (orderDirty) {
      message.warning('请先保存当前排序，再添加文章');
      return;
    }

    setPendingPostId(post.id);
    try {
      const response = await axios.post(`/api/collection/${collectionId}/posts`, {
        post_ids: [post.id],
      });
      if (!response.data.status) {
        throw new Error(response.data.message || '添加文章失败');
      }

      await loadSelectedArticles();
      message.success('已添加到合集顶部');
    } catch (error) {
      console.error('添加文章到合集失败:', error);
      message.error(error instanceof Error ? error.message : '添加文章失败');
    } finally {
      setPendingPostId(null);
    }
  };

  const handleRemove = async (postId: number) => {
    if (orderDirty) {
      message.warning('请先保存当前排序，再移除文章');
      return;
    }

    setPendingPostId(postId);
    try {
      const response = await axios.delete(`/api/collection/${collectionId}/posts`, {
        data: { post_ids: [postId] },
      });
      if (!response.data.status) {
        throw new Error(response.data.message || '移除文章失败');
      }

      await loadSelectedArticles();
      message.success('已从合集中移除');
    } catch (error) {
      console.error('移除合集文章失败:', error);
      message.error(error instanceof Error ? error.message : '移除文章失败');
    } finally {
      setPendingPostId(null);
    }
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= selectedArticles.length) return;

    setSelectedArticles((articles) => {
      const nextArticles = [...articles];
      [nextArticles[index], nextArticles[targetIndex]] = [nextArticles[targetIndex], nextArticles[index]];
      return nextArticles;
    });
    setOrderDirty(true);
  };

  const handleSaveOrder = async () => {
    setSavingOrder(true);
    try {
      const response = await axios.put(`/api/collection/${collectionId}/posts/sort`, {
        orders: selectedArticles.map((article, index) => ({
          post_id: article.id,
          sort_order: selectedArticles.length - index,
        })),
      });
      if (!response.data.status) {
        throw new Error(response.data.message || '保存排序失败');
      }

      await loadSelectedArticles();
      message.success('排序已保存');
    } catch (error) {
      console.error('保存合集文章排序失败:', error);
      message.error(error instanceof Error ? error.message : '保存排序失败');
    } finally {
      setSavingOrder(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <AdminPageHeader
        title={`${collection?.title || '合集'} - 文章管理`}
        description="序号越大越靠前；新增文章会进入合集顶部，使用上下箭头调整目录后再保存排序。"
        extra={(
          <Space wrap>
            <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => router.push('/c/collections')}>
              返回合集
            </Button>
            <Button
              size="small"
              color="primary"
              variant="solid"
              icon={<SaveOutlined />}
              onClick={handleSaveOrder}
              disabled={!orderDirty || selectedArticles.length === 0}
              loading={savingOrder}
            >
              保存排序
            </Button>
          </Space>
        )}
      />

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <div className="space-y-4 pb-1">
          <Alert
            type={orderDirty ? 'warning' : 'info'}
            showIcon
            message={orderDirty ? '排序尚未保存' : '操作说明'}
            description={orderDirty
              ? '请先保存排序，再继续添加或移除文章，以免覆盖当前调整。'
              : '下方搜索仅查询当前页的服务器数据，不会把全部文章加载到浏览器。'}
          />

          <Card size="small" title="添加文章">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Search
                allowClear
                placeholder="按文章标题或正文搜索"
                value={searchInputValue}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSearchInputValue(nextValue);
                  if (!nextValue) {
                    setSearchQuery('');
                    setCandidatePage(1);
                  }
                }}
                onSearch={handleSearch}
                enterButton={<SearchOutlined />}
                className="w-full sm:max-w-md"
              />
              <Tag color="blue">共 {candidateTotal} 篇匹配文章</Tag>
            </div>

            <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
              {candidateLoading ? (
                <div className="flex min-h-32 items-center justify-center"><Spin /></div>
              ) : candidateArticles.length === 0 ? (
                <Empty className="my-8" description="没有找到可显示的文章" />
              ) : candidateArticles.map((article) => {
                const isSelected = selectedArticleIds.has(article.id);
                return (
                  <div key={article.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-900">{article.title || '无标题文章'}</div>
                      {article.description ? (
                        <div className="mt-1 line-clamp-1 text-sm text-slate-500">{article.description}</div>
                      ) : null}
                      <div className="mt-1 text-xs text-slate-400">
                        {article.date ? dayjs(article.date).format('YYYY-MM-DD') : '未设置发布日期'}
                      </div>
                    </div>
                    <Button
                      size="small"
                      color={isSelected ? undefined : 'primary'}
                      variant={isSelected ? 'outlined' : 'solid'}
                      icon={isSelected ? undefined : <PlusOutlined />}
                      disabled={isSelected || orderDirty}
                      loading={pendingPostId === article.id}
                      onClick={() => void handleAdd(article)}
                    >
                      {isSelected ? '已在合集' : '添加'}
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end">
              <Pagination
                current={candidatePage}
                pageSize={CANDIDATE_PAGE_SIZE}
                total={candidateTotal}
                showSizeChanger={false}
                size={isMobile ? 'small' : 'default'}
                onChange={setCandidatePage}
                showTotal={(total) => `共 ${total} 篇`}
              />
            </div>
          </Card>

          <Card
            size="small"
            title={`合集目录（${selectedArticles.length} 篇）`}
            extra={orderDirty ? <Tag color="orange">待保存排序</Tag> : null}
          >
            {selectedArticles.length === 0 ? (
              <Empty className="my-8" description="还没有添加文章到这个合集" />
            ) : (
              <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
                {selectedArticles.map((article, index) => (
                  <div key={article.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                    <span className="w-7 shrink-0 text-center font-mono text-sm text-slate-400">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-900">{article.title || '无标题文章'}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {article.date ? dayjs(article.date).format('YYYY-MM-DD') : '未设置发布日期'}
                        {' · '}👁️ {article.visitors || 0} · ❤️ {article.likes || 0}
                      </div>
                    </div>
                    <Space size={4} wrap>
                      <Button
                        size="small"
                        icon={<ArrowUpOutlined />}
                        aria-label="上移文章"
                        disabled={index === 0 || pendingPostId === article.id}
                        onClick={() => handleMove(index, -1)}
                      />
                      <Button
                        size="small"
                        icon={<ArrowDownOutlined />}
                        aria-label="下移文章"
                        disabled={index === selectedArticles.length - 1 || pendingPostId === article.id}
                        onClick={() => handleMove(index, 1)}
                      />
                      <Button
                        size="small"
                        color="danger"
                        icon={<MinusCircleOutlined />}
                        disabled={orderDirty}
                        loading={pendingPostId === article.id}
                        onClick={() => void handleRemove(article.id)}
                      >
                        {isMobile ? '' : '移除'}
                      </Button>
                    </Space>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
