/**
 * 评论区组件
 * 显示文章评论，支持发表评论和回复
 * 数据存储在数据库
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Avatar, Button, message, Typography, Space, Spin, Empty, Collapse, Tabs } from 'antd';
import { SendOutlined, LoginOutlined, EditOutlined, EyeOutlined, LikeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import MarkdownEditor from './MarkdownEditor';
import MarkdownPreview from './MarkdownPreview';
import type { CommentTreeNode } from '@/dto/comment.dto';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text } = Typography;

interface CommentSectionProps {
  /**
   * 文章 ID
   */
  postId: number;
}

/**
 * 单条评论组件
 */
interface CommentItemProps {
  comment: CommentTreeNode;
  currentUser: { id: number } | null;
  onReply: (comment: CommentTreeNode) => void;
  onDelete: (commentId: number) => void;
  onLike: (commentId: number) => void;
  depth?: number;
}

function CommentItem({ comment, currentUser, onReply, onDelete, onLike, depth = 0 }: CommentItemProps) {
  const [isLiking, setIsLiking] = useState(false);

  const handleLike = async () => {
    try {
      setIsLiking(true);
      await axios.post(`/api/comment/${comment.id}/like`);
      onLike(comment.id);
      message.success('点赞成功');
    } catch (error) {
      console.error('点赞失败:', error);
      message.error('点赞失败');
    } finally {
      setIsLiking(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`/api/comment/${comment.id}`);
      onDelete(comment.id);
      message.success('删除成功');
    } catch (error) {
      console.error('删除失败:', error);
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message.error(error.response.data.message);
      } else {
        message.error('删除失败');
      }
    }
  };

  // 计算头像
  const avatarUrl = comment.user.avatar || undefined;

  // 最大深度限制（防止无限嵌套）
  const maxDepth = 5;
  const isNested = depth < maxDepth;

  return (
    <div
      className={`border-b border-border-light pb-4 last:border-b-0 dark:border-border-dark ${
        depth > 0 ? 'ml-8 pl-4 border-l-2 border-border-light dark:border-border-dark' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar src={avatarUrl} size={depth > 0 ? 32 : 40}>
          {comment.user.nickname.charAt(0)}
        </Avatar>
        <div className="flex-1">
          <Space size="small">
            <Text strong>{comment.user.nickname}</Text>
            <Text type="secondary" className="text-xs">
              {dayjs(comment.created_at).fromNow()}
            </Text>
            {comment.updated_at !== comment.created_at && (
              <Text type="secondary" className="text-xs">
                (已编辑)
              </Text>
            )}
          </Space>

          {/* 被回复的用户信息 */}
          {comment.reply_to && (
            <div className="mb-1">
              <Text type="secondary" className="text-xs">
                回复 @{comment.reply_to.nickname}
              </Text>
            </div>
          )}

          <div className="prose dark:prose-invert mt-2 max-w-none text-sm">
            <MarkdownPreview content={comment.content} />
          </div>

          {/* 操作按钮 */}
          <div className="mt-2 flex items-center gap-4">
            <Button
              type="text"
              size="small"
              icon={<LikeOutlined />}
              onClick={handleLike}
              loading={isLiking}
            >
              {comment.like_count > 0 && comment.like_count}
            </Button>
            <Button
              type="text"
              size="small"
              onClick={() => onReply(comment)}
            >
              回复
            </Button>
            {currentUser?.id === comment.user_id && (
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={handleDelete}
              >
                删除
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 子评论 */}
      {isNested && comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 space-y-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUser={currentUser}
              onReply={onReply}
              onDelete={onDelete}
              onLike={onLike}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 评论区组件
 */
export default function CommentSection({ postId }: CommentSectionProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [comments, setComments] = useState<CommentTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState('');
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [replyTo, setReplyTo] = useState<CommentTreeNode | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [canComment, setCanComment] = useState(false);
  const [missingBindings, setMissingBindings] = useState<string[]>([]);

  // 当前页面完整 URL（用于登录后跳回）
  const redirectUrl = useMemo(() => {
    const search = searchParams.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [pathname, searchParams]);

  /**
   * 加载评论列表
   */
  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/comment/list?postId=${postId}`);

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
  }, [postId]);

  /**
   * 检查用户是否有评论权限
   */
  const checkCommentPermission = useCallback(async () => {
    if (!user) {
      setCanComment(false);
      return;
    }

    // 检查用户是否绑定了邮箱、GitHub 或微信
    const missing: string[] = [];
    if (!user.mail) missing.push('邮箱');
    if (!user.github_id) missing.push('GitHub');
    if (!user.wx_open_id && !user.work_wechat_id) missing.push('微信');

    setMissingBindings(missing);
    setCanComment(missing.length < 3); // 至少绑定一种方式
  }, [user]);

  /**
   * 初始化加载
   */
  useEffect(() => {
    void loadComments();
    void checkCommentPermission();
  }, [loadComments, checkCommentPermission]);

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
        parentId: replyTo?.id,
      });

      if (response.data.status) {
        message.success(replyTo ? '回复成功' : '评论成功');
        setContent('');
        setReplyTo(null);
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
   * 回复评论
   */
  const handleReply = (comment: CommentTreeNode) => {
    if (!user) {
      message.warning('请先登录');
      return;
    }
    setReplyTo(comment);
    setEditorOpen(true); // 自动展开编辑器
  };

  /**
   * 取消回复
   */
  const handleCancelReply = () => {
    setReplyTo(null);
  };

  /**
   * 评论被删除后更新列表
   */
  const handleCommentDeleted = (commentId: number) => {
    // 递归删除评论
    const removeComment = (list: CommentTreeNode[]): CommentTreeNode[] => {
      return list.filter((comment) => {
        if (comment.id === commentId) return false;
        if (comment.replies) {
          comment.replies = removeComment(comment.replies);
        }
        return true;
      });
    };
    setComments(removeComment(comments));
  };

  /**
   * 评论被点赞后更新数据
   */
  const handleCommentLiked = (commentId: number) => {
    const updateLikeCount = (list: CommentTreeNode[]): CommentTreeNode[] => {
      return list.map((comment) => {
        if (comment.id === commentId) {
          return { ...comment, like_count: comment.like_count + 1 };
        }
        if (comment.replies) {
          return { ...comment, replies: updateLikeCount(comment.replies) };
        }
        return comment;
      });
    };
    setComments(updateLikeCount(comments));
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

    if (!canComment) {
      return (
        <div className="mb-6 rounded-lg bg-orange-50 p-6 text-center dark:bg-orange-900/20">
          <Space direction="vertical" size="middle" className="w-full">
            <Text>需要绑定以下任一方式才能评论：{missingBindings.join('、')}</Text>
            <Link href="/c/user/info">
              <Button type="primary">前往绑定</Button>
            </Link>
          </Space>
        </div>
      );
    }

    return (
      <div className="mb-6">
        {/* 回复提示 - 显示被回复的评论 */}
        {replyTo && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar src={replyTo.user.avatar || undefined} size={24}>
                  {replyTo.user.nickname.charAt(0)}
                </Avatar>
                <Text strong className="text-sm">
                  回复 @{replyTo.user.nickname}
                </Text>
              </div>
              <Button type="link" size="small" onClick={handleCancelReply}>
                取消回复
              </Button>
            </div>
            <div className="mt-2 rounded border border-border-light bg-card-light p-3 dark:border-border-dark dark:bg-card-dark">
              <div className="prose dark:prose-invert max-w-none text-sm">
                <MarkdownPreview content={replyTo.content} />
              </div>
            </div>
          </div>
        )}

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
              {replyTo ? '发表回复' : '发表评论'}
            </Button>
          }
        >
          <Tabs.TabPane
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
                placeholder={replyTo ? `回复 @${replyTo.user.nickname}...` : '支持 Markdown 格式，分享你的想法...'}
                preview={false}
              />
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane
            tab={
              <span>
                <EyeOutlined /> 预览
              </span>
            }
            key="preview"
          >
            <div className="min-h-[200px] rounded border border-border-light bg-card-light p-4 dark:border-border-dark dark:bg-card-dark">
              {content ? (
                <div className="prose dark:prose-invert max-w-none">
                  <MarkdownPreview content={content} />
                </div>
              ) : (
                <Text type="secondary">暂无内容</Text>
              )}
            </div>
          </Tabs.TabPane>
        </Tabs>
      </div>
    );
  };

  // 计算总评论数（包括回复）
  const totalComments = useMemo(() => {
    const countReplies = (list: CommentTreeNode[]): number => {
      return list.reduce((acc, comment) => {
        return acc + 1 + (comment.replies ? countReplies(comment.replies) : 0);
      }, 0);
    };
    return countReplies(comments);
  }, [comments]);

  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <Title level={3} className="mb-6">
          评论 {totalComments > 0 && `(${totalComments})`}
        </Title>

        <Collapse
          activeKey={editorOpen ? ['comment-editor'] : []}
          onChange={(keys) => {
            setEditorOpen(keys.includes('comment-editor'));
          }}
          bordered={false}
          className="mb-6"
          items={[
            {
              key: 'comment-editor',
              label: replyTo ? `回复 @${replyTo.user.nickname}` : '写评论',
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
          <Empty description="暂无评论，来发表第一条评论吧" className="py-8" />
        ) : (
          <div className="space-y-6">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUser={user}
                onReply={handleReply}
                onDelete={handleCommentDeleted}
                onLike={handleCommentLiked}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
