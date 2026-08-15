/**
 * 点赞按钮组件（客户端组件）
 * 新增：初始点赞状态支持
 */

'use client';

import React, { useState } from 'react';
import { Button } from 'antd';
import { message } from "@/components/AntdAppFeedbackBridge";
import { HeartOutlined, HeartFilled } from '@ant-design/icons';
import axios, { type AxiosError } from 'axios';

interface PostLikeButtonProps {
  /**
   * 文章ID
   */
  postId: number;
  /**
   * 初始点赞数
   */
  initialLikes: number;
  /**
   * 初始点赞状态（服务端传入）
   */
  initialLiked?: boolean;
}

export default function PostLikeButton({
  postId,
  initialLikes,
  initialLiked = false
}: PostLikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikes);
  const [loading, setLoading] = useState(false);

  /**
   * 处理点赞
   */
  const handleLike = async () => {
    if (liked || loading) return;

    setLoading(true);
    try {
      await axios.put(`/api/post/fav?id=${postId}&type=likes`);
      setLikes((prev) => prev + 1);
      setLiked(true);
      message.success('感谢点赞！');
    } catch (error) {
      console.error('点赞失败:', error);
      const axiosError = error as AxiosError<{ message?: string }>;
      const errorMsg = axiosError.response?.data?.message || '点赞失败';
      if (errorMsg.includes('已经点过赞')) {
        setLiked(true);
        message.warning('您已经点过赞了');
      } else {
        message.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type={liked ? 'default' : 'primary'}
      size="large"
      icon={liked ? <HeartFilled /> : <HeartOutlined />}
      onClick={handleLike}
      disabled={liked || loading}
      loading={loading}
    >
      {liked ? '已点赞' : '点赞'} ({likes})
    </Button>
  );
}
