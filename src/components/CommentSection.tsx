/**
 * 评论区组件
 * 显示文章评论，支持发表评论（需要 GitHub 账号）
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Avatar, Button, message, Typography, Space, Spin, Empty, Tabs, Collapse } from 'antd';
import { GithubOutlined, SendOutlined, LoginOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import MarkdownEditor from './MarkdownEditor';
import MarkdownPreview from './MarkdownPreview';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface Comment {
  id: number;
  author: string;
  avatar: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  url: string;
}

interface CommentSectionProps {
  /**
   * 文章 ID
   */
  postId: number;
}

/**
 * 评论区组件
 */
export default function CommentSection({ postId }: CommentSectionProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState('');
  const [hasGithub, setHasGithub] = useState(false);
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  
  // 当前页面完整 URL（用于登录后跳回）
  const redirectUrl = useMemo(() => {
    const search = searchParams.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [pathname, searchParams]);
  
  /**
   * 加载评论列表
   */
  const loadComments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/comment/${postId}`);
      
      if (response.data.status) {
        setComments(response.data.data.comments || []);
      } else {
        message.error(response.data.message || '加载评论失败');
      }
    } catch (error) {
      console.error('加载评论失败:', error);
      message.error('加载评论失败');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 检查用户是否绑定了 GitHub
   */
  const checkGithubBinding = async () => {
    if (!user) {
      setHasGithub(false);
      return;
    }
    
    try {
      const response = await axios.get('/api/user/info');
      if (response.data.status && response.data.data) {
        const userData = response.data.data;
        setHasGithub(!!userData.github_id);
      }
    } catch (error) {
      console.error('检查 GitHub 绑定状态失败:', error);
    }
  };
  
  /**
   * 初始化加载
   */
  useEffect(() => {
    loadComments();
    checkGithubBinding();
  }, [postId, user]);
  
  /**
   * 提交评论
   */
  const handleSubmit = async () => {
    if (!content.trim()) {
      message.warning('请输入评论内容');
      return;
    }
    
    try {
      setSubmitting(true);
      const response = await axios.post('/api/comment/create', {
        postId,
        content: content.trim(),
      });
      
      if (response.data.status) {
        message.success('评论成功');
        setContent('');
        // 重新加载评论列表
        await loadComments();
      } else {
        message.error(response.data.message || '评论失败');
      }
    } catch (error) {
      console.error('评论失败:', error);
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error('评论失败');
      }
    } finally {
      setSubmitting(false);
    }
  };
  
  /**
   * 渲染评论输入框
   */
  const renderCommentInput = () => {
    if (!user) {
      return (
        <div className="mb-6 rounded-lg bg-blue-50 p-6 text-center dark:bg-blue-900/20">
          <Text className="mb-4 block">请先登录后发表评论</Text>
          <Link href={`/login?redirect=${encodeURIComponent(redirectUrl)}`}>
            <Button type="primary" icon={<LoginOutlined />}>
              前往登录
            </Button>
          </Link>
        </div>
      );
    }
    
    if (!hasGithub) {
      return (
        <div className="mb-6 rounded-lg bg-orange-50 p-6 text-center dark:bg-orange-900/20">
          <Space orientation="vertical" size="middle" className="w-full">
            <div>
              <GithubOutlined className="text-4xl" />
            </div>
            <Text>需要绑定 GitHub 账号才能发表评论</Text>
            <Link href="/c/user/info">
              <Button type="primary" icon={<GithubOutlined />}>
                前往绑定 GitHub
              </Button>
            </Link>
          </Space>
        </div>
      );
    }
    
    return (
      <div className="mb-6">
        <Tabs 
          activeKey={editorMode} 
          onChange={(key) => setEditorMode(key as 'edit' | 'preview')}
          tabBarExtraContent={
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSubmit}
              loading={submitting}
              disabled={!content.trim()}
            >
              发表评论
            </Button>
          }
        >
          <TabPane 
            tab={
              <span>
                <EditOutlined /> 编辑
              </span>
            } 
            key="edit"
          >
            <div className="min-h-[200px]">
              <MarkdownEditor
                value={content}
                onChange={(val) => setContent(val || '')}
                placeholder="支持 Markdown 格式，分享你的想法..."
                preview={false}
              />
            </div>
          </TabPane>
          <TabPane 
            tab={
              <span>
                <EyeOutlined /> 预览
              </span>
            } 
            key="preview"
          >
            <div className="min-h-[200px] rounded border border-gray-200 p-4 dark:border-gray-700">
              {content ? (
                <div className="prose dark:prose-invert max-w-none">
                  <MarkdownPreview content={content} />
                </div>
              ) : (
                <Text type="secondary">暂无内容</Text>
              )}
            </div>
          </TabPane>
        </Tabs>
      </div>
    );
  };
  
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <Title level={3} className="mb-6">
          评论 {comments.length > 0 && `(${comments.length})`}
        </Title>
        
        <Collapse
          defaultActiveKey={[]}
          bordered={false}
          className="mb-6"
          items={[
            {
              key: 'comment-editor',
              label: '写评论',
              children: renderCommentInput(),
            },
          ]}
        />
        
        {loading ? (
          <div className="py-12 text-center">
            <Spin size="large" />
            <Text className="mt-4 block" type="secondary">
              加载中...
            </Text>
          </div>
        ) : comments.length === 0 ? (
          <Empty
            description="暂无评论，来发表第一条评论吧"
            className="py-8"
          />
        ) : (
          <div className="space-y-6">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="border-b border-gray-100 pb-4 last:border-b-0 dark:border-gray-800"
              >
                <div className="flex items-start gap-3">
                  <a
                    href={`https://github.com/${comment.author}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Avatar src={comment.avatar} size={48} />
                  </a>
                  <div className="flex-1">
                    <Space>
                      <a
                        href={`https://github.com/${comment.author}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:text-blue-500"
                      >
                        {comment.author}
                      </a>
                      <Text type="secondary" className="text-sm">
                        {dayjs(comment.createdAt).fromNow()}
                      </Text>
                      {comment.createdAt !== comment.updatedAt && (
                        <Text type="secondary" className="text-xs">
                          (已编辑)
                        </Text>
                      )}
                    </Space>
                    <div className="prose dark:prose-invert mt-2 max-w-none">
                      <MarkdownPreview content={comment.content} />
                    </div>
                    <div className="mt-2">
                      <a
                        href={comment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-500 hover:text-blue-500"
                      >
                        在 GitHub 上查看
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {comments.length > 0 && process.env.NEXT_PUBLIC_GITHUB_REPO && (
          <div className="mt-6 rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-800">
            <Text type="secondary" className="text-sm">
              评论数据存储在 GitHub Issues，你可以在{' '}
              <a
                href={`https://github.com/${process.env.NEXT_PUBLIC_GITHUB_REPO}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                GitHub 仓库
              </a>
              {' '}中查看和管理
            </Text>
          </div>
        )}
      </Card>
    </div>
  );
}
