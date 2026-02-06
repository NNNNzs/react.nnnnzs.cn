/**
 * 向量检索测试页面
 * 路由: /c/vector-search
 * 仅管理员可访问
 */

'use client';

import React, { useState } from 'react';
import { Card, Input, Button, List, Tag, Space, Typography, Alert, Divider, Row, Col, Statistic } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/types/role';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface SearchResult {
  postId: number;
  chunkIndex: number;
  chunkText: string;
  title: string;
  score: number;
}

export default function VectorSearchPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 权限检查
  if (!user || !isAdmin(user.role)) {
    return (
      <div className="flex h-screen items-center justify-center p-8">
        <Alert
          message="权限不足"
          description="您没有权限访问此页面，仅管理员可访问。"
          type="error"
          showIcon
        />
      </div>
    );
  }

  /**
   * 执行向量搜索
   */
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('请输入搜索内容');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axios.post('/api/search/vector', {
        query: searchQuery,
        limit: 10,
      });

      if (response.data.status) {
        setSearchResults(response.data.data.results || []);
      } else {
        setError(response.data.message || '搜索失败');
        setSearchResults([]);
      }
    } catch (err) {
      console.error('向量搜索失败:', err);
      setError('向量搜索失败，请检查向量化服务是否正常运行');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 清空搜索
   */
  const handleClear = () => {
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
  };

  /**
   * 跳转到文章详情
   */
  const handleViewPost = (postId: number) => {
    window.open(`/post/${postId}`, '_blank');
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* 页面标题 */}
        <div className="mb-6">
          <Title level={2} className="mb-2">向量检索测试</Title>
          <Text type="secondary">测试语义搜索功能，查找相关文章片段</Text>
        </div>

        {/* 搜索区域 */}
        <Card className="mb-6">
          <Space direction="vertical" className="w-full" size="large">
            <div>
              <Text strong className="mb-2 block">搜索内容</Text>
              <TextArea
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="输入要搜索的内容，例如：React hooks 使用方法、Next.js 性能优化..."
                rows={4}
                onPressEnter={(e) => {
                  if (e.shiftKey) return;
                  e.preventDefault();
                  handleSearch();
                }}
              />
            </div>

            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
                loading={loading}
                size="large"
              >
                搜索
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleClear}
                disabled={!searchQuery && searchResults.length === 0}
              >
                清空
              </Button>
            </Space>

            {/* 示例查询 */}
            <div>
              <Text type="secondary" className="mb-2 block">示例查询（点击填充）：</Text>
              <Space wrap>
                {['React useState 使用', 'Next.js 路由配置', 'TypeScript 类型定义', 'Prisma 数据库查询'].map((example) => (
                  <Tag
                    key={example}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSearchQuery(example)}
                  >
                    {example}
                  </Tag>
                ))}
              </Space>
            </div>
          </Space>
        </Card>

        {/* 错误提示 */}
        {error && (
          <Alert
            message="错误"
            description={error}
            type="error"
            closable
            className="mb-6"
            onClose={() => setError(null)}
          />
        )}

        {/* 搜索结果 */}
        {searchResults.length > 0 && (
          <Card>
            <Row gutter={16} className="mb-4">
              <Col span={8}>
                <Statistic title="找到结果" value={searchResults.length} />
              </Col>
              <Col span={8}>
                <Statistic
                  title="最高相关度"
                  value={Math.round(searchResults[0]?.score * 100)}
                  suffix="%"
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="平均相关度"
                  value={Math.round(
                    searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length * 100
                  )}
                  suffix="%"
                />
              </Col>
            </Row>

            <Divider />

            <List
              dataSource={searchResults}
              renderItem={(item, index) => (
                <List.Item
                  key={`${item.postId}-${item.chunkIndex}`}
                  className="flex flex-col items-start"
                >
                  <div className="w-full">
                    <div className="flex items-start justify-between mb-2">
                      <Space>
                        <Text strong>#{index + 1}</Text>
                        <Text strong>{item.title}</Text>
                        <Tag color="blue">文章ID: {item.postId}</Tag>
                        <Tag color="cyan">片段: {item.chunkIndex}</Tag>
                      </Space>
                      <Space>
                        <Tag color="green">
                          相关度: {Math.round(item.score * 100)}%
                        </Tag>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => handleViewPost(item.postId)}
                        >
                          查看文章
                        </Button>
                      </Space>
                    </div>

                    <Card
                      size="small"
                      className="w-full bg-gray-50"
                    >
                      <Paragraph
                        ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                        className="mb-0"
                      >
                        {item.chunkText}
                      </Paragraph>
                    </Card>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        )}

        {/* 空状态 */}
        {searchResults.length === 0 && !loading && !error && (
          <Card>
            <div className="text-center py-12 text-gray-400">
              <SearchOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <div>输入搜索内容，测试向量检索功能</div>
            </div>
          </Card>
        )}

        {/* 使用说明 */}
        <Card type="inner" title="使用说明" className="mt-6">
          <Space direction="vertical" className="w-full">
            <Text>• 向量检索基于语义相似度，而非关键词匹配</Text>
            <Text>• 搜索结果包含最相关的文章片段，按相似度排序</Text>
            <Text>• 相关度越高表示内容越相关（0-100%）</Text>
            <Text>• 搜索结果来自已完成向量化的文章</Text>
            <Divider className="my-2" />
            <Text strong>提示：</Text>
            <Text>• 使用自然语言描述，例如：&ldquo;如何优化 React 性能&rdquo;</Text>
            <Text>• 可以搜索代码相关的概念，例如：&ldquo;异步函数使用&rdquo;</Text>
            <Text>• 尝试不同的表述方式，找到最相关的结果</Text>
          </Space>
        </Card>
      </div>
    </div>
  );
}
