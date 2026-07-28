/**
 * 评论服务
 */

import { getPrisma } from '@/lib/prisma';
import type { CommentTreeNode, CreateCommentRequest, UserInfoForComment } from '@/dto/comment.dto';
import type { TbUser, TbComment } from '@/generated/prisma-client/client';
import { deliverNotificationEmail } from '@/services/notification-email';
import { isInboxNotificationEnabled } from '@/services/notification';
import { truncateNotificationPreview, type NotificationType } from '@/types/notification';

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
  const result = await prisma.$transaction(async (tx) => {
    const post = await tx.tbPost.findUnique({
      where: { id: data.postId },
      select: { id: true, title: true, path: true, created_by: true },
    });
    if (!post) throw new Error('文章不存在');

    const parentComment = data.parentId
      ? await tx.tbComment.findUnique({
          where: { id: data.parentId },
          include: { user: { select: { id: true, nickname: true } } },
        })
      : null;
    if (data.parentId && (!parentComment || parentComment.is_delete === 1)) {
      throw new Error('父评论不存在或已删除');
    }
    if (parentComment && parentComment.post_id !== data.postId) {
      throw new Error('父评论不属于该文章');
    }

    const comment = await tx.tbComment.create({
      data: { post_id: data.postId, user_id: userId, parent_id: data.parentId || null, content: data.content },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
        parent: { include: { user: { select: { id: true, nickname: true } } } },
      },
    });

    const recipients = new Map<number, NotificationType>();
    if (post.created_by && post.created_by !== userId) recipients.set(post.created_by, 'COMMENT_ON_POST');
    if (parentComment && parentComment.user_id !== userId) recipients.set(parentComment.user_id, 'COMMENT_REPLY');

    const recipientUsers = recipients.size
      ? await tx.tbUser.findMany({
          where: { id: { in: [...recipients.keys()] } },
          select: { id: true, mail: true, notification_settings: true },
        })
      : [];
    const targetUrl = post.path || `/post/${post.id}`;
    const preview = truncateNotificationPreview(comment.content);
    const deliveries: Array<{
      notificationId: number;
      recipientId: number;
      recipientMail: string | null;
      recipientSettings: unknown;
      type: NotificationType;
      actorName: string;
      postTitle: string;
      preview: string;
      targetUrl: string;
    }> = [];

    for (const recipient of recipientUsers) {
      const type = recipients.get(recipient.id);
      if (!type || !isInboxNotificationEnabled(recipient.notification_settings, type)) continue;
      const notification = await tx.tbNotification.create({
        data: {
          type,
          recipient_user_id: recipient.id,
          actor_user_id: userId,
          post_id: post.id,
          comment_id: comment.id,
          title: type === 'COMMENT_REPLY' ? '有人回复了你的评论' : '你的文章收到了新评论',
          preview,
          target_url: targetUrl,
        },
      });
      deliveries.push({
        notificationId: notification.id,
        recipientId: recipient.id,
        recipientMail: recipient.mail,
        recipientSettings: recipient.notification_settings,
        type,
        actorName: comment.user.nickname,
        postTitle: post.title || '未命名文章',
        preview,
        targetUrl,
      });
    }

    return { comment, deliveries };
  });

  await Promise.all(result.deliveries.map((delivery) => deliverNotificationEmail(delivery)));
  return commentToTreeNode(result.comment as typeof result.comment & { user: TbUser; parent?: (typeof result.comment & { user: TbUser }) | null });
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

  await prisma.$transaction([
    prisma.tbComment.update({ where: { id: commentId }, data: { is_delete: 1 } }),
    prisma.tbNotification.deleteMany({ where: { comment_id: commentId } }),
  ]);
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
