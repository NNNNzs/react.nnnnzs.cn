/**
 * 合集点赞按钮组件
 */

'use client';

import React, { useState } from 'react';
import { Button, message } from 'antd';
import { HeartOutlined, HeartFilled } from '@ant-design/icons';
import axios from 'axios';

interface CollectionLikeButtonProps {
  /**
   * 合集ID
   */
  collectionId: number;
  /**
   * 合集 slug
   */
  collectionSlug: string;
  /**
   * 初始点赞数
   */
  initialLikes: number;
  /**
   * 初始点赞状态（服务端传入）
   */
  initialLiked?: boolean;
}

export default function CollectionLikeButton({
  collectionId,
  collectionSlug,
  initialLikes,
  initialLiked = false,
}: CollectionLikeButtonProps) {
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
      await axios.post(`/api/collections/${collectionSlug}/likes`);
      setLikes((prev) => prev + 1);
      setLiked(true);
      message.success('感谢点赞！');
    } catch (error) {
      console.error('点赞失败:', error);
      const errorMsg = (error as any)?.response?.data?.message || '点赞失败';
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
