/**
 * 评论相关 DTO
 */

/**
 * 树形评论节点
 */
export interface CommentTreeNode {
  id: number;
  post_id: number;
  user_id: number;
  parent_id: number | null;
  content: string;
  status: number;
  is_delete: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  // 关联的用户信息
  user: {
    id: number;
    nickname: string;
    avatar: string | null;
  };
  // 被回复的用户信息（仅在回复时存在）
  reply_to?: {
    id: number;
    nickname: string;
  };
  // 子评论
  replies?: CommentTreeNode[];
}

/**
 * 创建评论请求
 */
export interface CreateCommentRequest {
  postId: number;
  content: string;
  parentId?: number;
}

/**
 * 评论列表响应
 */
export interface CommentListResponse {
  comments: CommentTreeNode[];
  total: number;
}

/**
 * 权限检查结果
 */
export interface CommentPermissionResult {
  canComment: boolean;
  missingBindings: string[];
}

/**
 * 用户信息（用于评论权限检查）
 */
export interface UserInfoForComment {
  id: number;
  nickname: string;
  avatar: string | null;
  mail?: string | null;
  github_id?: string | null;
  wx_open_id?: string | null;
  work_wechat_id?: string | null;
}
