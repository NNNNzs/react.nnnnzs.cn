/**
 * 评论服务
 */

import { getPrisma } from '@/lib/prisma';
import type { CommentTreeNode, CreateCommentRequest, UserInfoForComment } from '@/dto/comment.dto';
import type { TbUser, TbComment } from '@/generated/prisma-client';

/**
 * 检查用户是否有评论权限
 * 满足以下任一条件即可评论：
 * 1. 绑定了邮箱
 * 2. 绑定了 GitHub
 * 3. 绑定了微信
 */
export function canComment(user: UserInfoForComment): boolean {
  return !!(
    user.mail ||
    user.github_id ||
    user.wx_open_id ||
    user.work_wechat_id
  );
}

/**
 * 获取缺失的绑定方式
 */
export function getMissingBindings(user: UserInfoForComment): string[] {
  const missing: string[] = [];
  if (!user.mail) missing.push('邮箱');
  if (!user.github_id) missing.push('GitHub');
  if (!user.wx_open_id && !user.work_wechat_id) missing.push('微信');
  return missing;
}

/**
 * 将数据库评论记录转换为树形节点
 */
function commentToTreeNode(
  comment: TbComment & {
    user: TbUser;
    parent?: (TbComment & { user: TbUser }) | null;
  }
): CommentTreeNode {
  const node: CommentTreeNode = {
    id: comment.id,
    post_id: comment.post_id,
    user_id: comment.user_id,
    parent_id: comment.parent_id,
    content: comment.content,
    status: comment.status,
    is_delete: comment.is_delete,
    like_count: comment.like_count,
    created_at: comment.created_at.toISOString(),
    updated_at: comment.updated_at.toISOString(),
    user: {
      id: comment.user.id,
      nickname: comment.user.nickname,
      avatar: comment.user.avatar,
    },
  };

  // 如果是回复，添加被回复用户信息
  if (comment.parent) {
    node.reply_to = {
      id: comment.parent.user_id,
      nickname: comment.parent.user.nickname,
    };
  }

  return node;
}

/**
 * 构建评论树形结构
 * 将平铺的评论列表转换为树形结构
 */
function buildCommentTree(comments: CommentTreeNode[]): CommentTreeNode[] {
  // 创建 ID 到评论的映射
  const commentMap = new Map<number, CommentTreeNode>();
  comments.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  // 构建树形结构
  const rootComments: CommentTreeNode[] = [];
  commentMap.forEach((comment) => {
    if (comment.parent_id === null) {
      // 顶级评论
      rootComments.push(comment);
    } else {
      // 子评论，添加到父评论的 replies 中
      const parent = commentMap.get(comment.parent_id);
      if (parent) {
        if (!parent.replies) {
          parent.replies = [];
        }
        parent.replies.push(comment);
      }
    }
  });

  return rootComments;
}

/**
 * 获取文章的评论列表（树形结构）
 */
export async function getCommentList(postId: number): Promise<{
  comments: CommentTreeNode[];
  total: number;
}> {
  const prisma = await getPrisma();

  // 获取文章的所有评论（包括被软删除的，用于过滤）
  const comments = await prisma.tbComment.findMany({
    where: {
      post_id: postId,
      is_delete: 0, // 仅获取未删除的评论
    },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          avatar: true,
        },
      },
      parent: {
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
            },
          },
        },
      },
    },
    orderBy: {
      created_at: 'asc', // 按时间正序排列
    },
  });

  // 转换为树形节点
  const commentNodes: CommentTreeNode[] = comments.map((c) =>
    commentToTreeNode(c as typeof c & { user: TbUser; parent?: (typeof c & { user: TbUser }) | null })
  );

  // 构建树形结构
  const tree = buildCommentTree(commentNodes);

  return {
    comments: tree,
    total: comments.length,
  };
}

/**
 * 创建评论
 */
export async function createComment(
  userId: number,
  data: CreateCommentRequest
): Promise<CommentTreeNode> {
  const prisma = await getPrisma();

  // 验证文章存在
  const post = await prisma.tbPost.findUnique({
    where: { id: data.postId },
  });

  if (!post) {
    throw new Error('文章不存在');
  }

  // 如果是回复，验证父评论存在
  if (data.parentId) {
    const parentComment = await prisma.tbComment.findUnique({
      where: { id: data.parentId },
    });

    if (!parentComment || parentComment.is_delete === 1) {
      throw new Error('父评论不存在或已删除');
    }

    // 父评论必须属于同一篇文章
    if (parentComment.post_id !== data.postId) {
      throw new Error('父评论不属于该文章');
    }
  }

  // 创建评论
  const comment = await prisma.tbComment.create({
    data: {
      post_id: data.postId,
      user_id: userId,
      parent_id: data.parentId || null,
      content: data.content,
    },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          avatar: true,
        },
      },
      parent: {
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
            },
          },
        },
      },
    },
  });

  return commentToTreeNode(comment as typeof comment & { user: TbUser; parent?: (typeof comment & { user: TbUser }) | null });
}

/**
 * 删除评论（软删除）
 */
export async function deleteComment(commentId: number, userId: number): Promise<void> {
  const prisma = await getPrisma();

  // 验证评论存在且属于该用户
  const comment = await prisma.tbComment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    throw new Error('评论不存在');
  }

  if (comment.user_id !== userId) {
    throw new Error('无权删除此评论');
  }

  // 软删除
  await prisma.tbComment.update({
    where: { id: commentId },
    data: { is_delete: 1 },
  });
}

/**
 * 点赞评论
 */
export async function likeComment(commentId: number): Promise<void> {
  const prisma = await getPrisma();

  // 验证评论存在且未删除
  const comment = await prisma.tbComment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    throw new Error('评论不存在');
  }

  if (comment.is_delete === 1) {
    throw new Error('评论已删除');
  }

  // 增加点赞数
  await prisma.tbComment.update({
    where: { id: commentId },
    data: {
      like_count: {
        increment: 1,
      },
    },
  });
}
