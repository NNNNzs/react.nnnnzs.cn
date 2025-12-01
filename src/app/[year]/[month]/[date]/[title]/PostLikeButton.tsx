/**
 * 点赞按钮组件（客户端组件）
 */

'use client';

import React, { useState } from 'react';
import { Button, message } from 'antd';
import { HeartOutlined, HeartFilled } from '@ant-design/icons';
import axios from 'axios';

interface PostLikeButtonProps {
  /**
   * 文章ID
   */
  postId: number;
  /**
   * 初始点赞数
   */
  initialLikes: number;
}

export default function PostLikeButton({ postId, initialLikes }: PostLikeButtonProps) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(initialLikes);

  /**
   * 处理点赞
   */
  const handleLike = async () => {
    if (liked) return;
    
    try {
      await axios.put(`/api/post/fav?id=${postId}&type=likes`);
      setLikes((prev) => prev + 1);
      setLiked(true);
      message.success('感谢点赞！');
    } catch (error) {
      console.error('点赞失败:', error);
      message.error('点赞失败');
    }
  };

  return (
    <Button
      type={liked ? 'default' : 'primary'}
      size="large"
      icon={liked ? <HeartFilled /> : <HeartOutlined />}
      onClick={handleLike}
      disabled={liked}
    >
      {liked ? '已点赞' : '点赞'} ({likes})
    </Button>
  );
}

