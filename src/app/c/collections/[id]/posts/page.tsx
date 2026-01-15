/**
 * 合集文章管理页面
 * 路由: /c/collections/[id]/posts
 * 功能: 添加/移除文章到合集，调整文章顺序
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Button,
  Card,
  message,
  Space,
  Spin,
  Input,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  SearchOutlined,
  PlusOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import type { SerializedCollection } from '@/dto/collection.dto';
import type { SerializedPost } from '@/dto/post.dto';
import dayjs from 'dayjs';

const { Search } = Input;

interface ArticleInCollection extends SerializedPost {
  sort_order: number;
}

export default function CollectionPostsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const collectionId = params.id as string;

  const [collection, setCollection] = useState<SerializedCollection | null>(null);
  const [allArticles, setAllArticles] = useState<SerializedPost[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<ArticleInCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState('');

  // 加载合集信息和文章
  useEffect(() => {
    if (collectionId && user) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 加载合集信息
      const collectionRes = await axios.get(
        `/api/collections?pageSize=100&pageNum=1&status=all`
      );
      if (collectionRes.data.status) {
        const coll = collectionRes.data.data.record.find(
          (c: SerializedCollection) => c.id === parseInt(collectionId, 10)
        );
        setCollection(coll || null);
      }

      // 加载合集内的文章
      const collectionDetailRes = await axios.get(
        `/api/collections/${collectionId}`
      );
      if (collectionDetailRes.data.status) {
        setSelectedArticles(collectionDetailRes.data.data.articles || []);
      }

      // 加载所有文章
      const articlesRes = await axios.get('/api/post/list', {
        params: { pageSize: 1000, pageNum: 1, hide: '0' },
      });
      if (articlesRes.data.status) {
        setAllArticles(articlesRes.data.data.record || []);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存文章关联
  const handleSave = async () => {
    setSaving(true);
    try {
      // 获取当前合集内的文章ID
      const currentIds = selectedArticles.map((a) => a.id);

      // 获取之前合集内的文章ID
      const beforeSaveRes = await axios.get(`/api/collections/${collectionId}`);
      const beforeIds = beforeSaveRes.data.status
        ? beforeSaveRes.data.data.articles.map((a: { id: number }) => a.id)
        : [];

      // 计算需要添加和移除的文章
      const toAdd = currentIds.filter((id: number) => !beforeIds.includes(id));
      const toRemove = beforeIds.filter((id: number) => !currentIds.includes(id));

      console.log('📝 保存合集文章:', { currentIds, beforeIds, toAdd, toRemove });

      // 添加新文章
      if (toAdd.length > 0) {
        console.log('➕ 添加文章到合集:', toAdd);
        const addRes = await axios.post(`/api/collection/${collectionId}/posts`, {
          post_ids: toAdd,
          sort_orders: toAdd.map((_, index) => index),
        });
        console.log('✅ 添加文章响应:', addRes.data);
      }

      // 移除文章
      if (toRemove.length > 0) {
        console.log('➖ 从合集移除文章:', toRemove);
        const removeRes = await axios.delete(`/api/collection/${collectionId}/posts`, {
          data: { post_ids: toRemove },
        });
        console.log('✅ 移除文章响应:', removeRes.data);
      }

      message.success('保存成功');
      loadData(); // 重新加载数据
    } catch (error: unknown) {
      console.error('❌ 保存失败:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        console.error('❌ 错误响应:', axiosError.response?.data);
        message.error(axiosError.response?.data?.message || '保存失败');
      } else {
        message.error('保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  // 从合集移除文章
  const handleRemove = async (postId: number) => {
    try {
      await axios.delete(`/api/collection/${collectionId}/posts`, {
        data: { post_ids: [postId] },
      });
      message.success('移除成功');
      loadData();
    } catch (error: unknown) {
      console.error('移除失败:', error);
      message.error('移除失败');
    }
  };

  // 调整文章顺序（上移）
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newArticles = [...selectedArticles];
    [newArticles[index - 1], newArticles[index]] = [newArticles[index], newArticles[index - 1]];
    setSelectedArticles(newArticles);
  };

  // 调整文章顺序（下移）
  const handleMoveDown = (index: number) => {
    if (index === selectedArticles.length - 1) return;
    const newArticles = [...selectedArticles];
    [newArticles[index], newArticles[index + 1]] = [newArticles[index + 1], newArticles[index]];
    setSelectedArticles(newArticles);
  };

  // 保存排序
  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      const orders = selectedArticles.map((article, index) => ({
        post_id: article.id,
        sort_order: index,
      }));

      await axios.put(`/api/collection/${collectionId}/posts/sort`, { orders });
      message.success('排序保存成功');
      loadData();
    } catch (error) {
      console.error('保存排序失败:', error);
      message.error('保存排序失败');
    } finally {
      setSaving(false);
    }
  };

  // 过滤文章
  const filteredArticles = allArticles.filter((article) =>
    article.title?.toLowerCase().includes(searchText.toLowerCase()) ||
    article.description?.toLowerCase().includes(searchText.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="p-6">
          <Card
            title={
              <Space>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => router.push('/c/collections')}
                >
                  返回
                </Button>
                <span>
                  {collection?.title} - 文章管理 ({selectedArticles.length} 篇)
                </span>
              </Space>
            }
            extra={
              <Space>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={saving}
                >
                  保存
                </Button>
              </Space>
            }
          >
            <Alert
              message="操作说明"
              description={
                <div>
                  <p>1. 在下方搜索并选择文章添加到合集</p>
                  <p>2. 使用上下箭头调整文章顺序</p>
                  <p>3. 点击&ldquo;移除&rdquo;按钮将文章从合集中移除</p>
                  <p>4. 点击&ldquo;保存&rdquo;按钮保存所有更改</p>
                </div>
              }
              type="info"
              showIcon
              className="mb-4"
            />

            {/* 搜索和添加文章 */}
            <div className="mb-6">
              <Search
                placeholder="搜索文章标题或描述"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 300, marginBottom: 16 }}
                prefix={<SearchOutlined />}
              />

              <div className="max-h-60 overflow-y-auto border border-gray-300 rounded p-2">
                {filteredArticles.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">没有找到匹配的文章</div>
                ) : (
                  filteredArticles.map((article) => {
                    const isSelected = selectedArticles.some((a) => a.id === article.id);
                    return (
                      <div
                        key={article.id}
                        className={`flex items-center justify-between p-2 mb-2 border rounded ${
                          isSelected ? 'border-gray-200 bg-gray-50' : 'border-blue-200 bg-blue-50'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="font-medium">{article.title}</div>
                          <div className="text-sm text-gray-500 line-clamp-1">
                            {article.description}
                          </div>
                          <div className="text-xs text-gray-400">
                            {article.date ? dayjs(article.date).format('YYYY-MM-DD') : ''}
                          </div>
                        </div>
                        <Button
                          type={isSelected ? 'default' : 'primary'}
                          size="small"
                          icon={isSelected ? <MinusCircleOutlined /> : <PlusOutlined />}
                          onClick={() => {
                            if (isSelected) {
                              // 移除
                              setSelectedArticles(selectedArticles.filter((a) => a.id !== article.id));
                            } else {
                              // 添加
                              setSelectedArticles([
                                ...selectedArticles,
                                { ...article, sort_order: selectedArticles.length },
                              ]);
                            }
                          }}
                        >
                          {isSelected ? '移除' : '添加'}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 已选文章列表 */}
            <div>
              <h3 className="text-lg font-semibold mb-4">
                已选文章 ({selectedArticles.length} 篇)
              </h3>

              {selectedArticles.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  还没有添加文章到合集
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedArticles.map((article, index) => (
                    <div
                      key={article.id}
                      className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded hover:shadow-sm transition-shadow"
                    >
                      {/* 序号 */}
                      <div className="text-2xl font-bold text-gray-400 w-8 text-center">
                        {String(index + 1).padStart(2, '0')}
                      </div>

                      {/* 文章信息 */}
                      <div className="flex-1">
                        <div className="font-medium">{article.title}</div>
                        <div className="text-sm text-gray-500 line-clamp-1">
                          {article.description}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {article.date ? dayjs(article.date).format('YYYY-MM-DD HH:mm') : ''} ·
                          👁️ {article.visitors || 0} · ❤️ {article.likes || 0}
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <Space>
                        <Button
                          size="small"
                          disabled={index === 0}
                          onClick={() => handleMoveUp(index)}
                        >
                          上移
                        </Button>
                        <Button
                          size="small"
                          disabled={index === selectedArticles.length - 1}
                          onClick={() => handleMoveDown(index)}
                        >
                          下移
                        </Button>
                        <Button
                          size="small"
                          danger
                          onClick={() => handleRemove(article.id)}
                        >
                          移除
                        </Button>
                      </Space>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedArticles.length > 1 && (
              <div className="mt-6 text-center">
                <Button type="primary" onClick={handleSaveOrder} loading={saving}>
                  保存排序
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
