/**
 * 权限码常量定义
 *
 * 所有权限码统一在此定义，其他地方通过枚举引用，禁止使用魔法字符串。
 */

// ============ 文章模块 ============
export const POST_VIEW = 'post:view';
export const POST_CREATE = 'post:create';
export const POST_EDIT = 'post:edit';
export const POST_DELETE = 'post:delete';
export const POST_RESTORE = 'post:restore';
export const POST_HIDE = 'post:hide';
export const POST_VIEW_DELETED = 'post:view_deleted';

// ============ 评论模块 ============
export const COMMENT_MANAGE = 'comment:manage';

// ============ 合集模块 ============
export const COLLECTION_VIEW = 'collection:view';
export const COLLECTION_CREATE = 'collection:create';
export const COLLECTION_EDIT = 'collection:edit';
export const COLLECTION_DELETE = 'collection:delete';

// ============ 配置模块 ============
export const CONFIG_VIEW = 'config:view';
export const CONFIG_EDIT = 'config:edit';

// ============ 用户模块 ============
export const USER_VIEW = 'user:view';
export const USER_MANAGE = 'user:manage';
export const USER_ROLE_ASSIGN = 'user:role:assign';

// ============ 工具模块 ============
export const QUEUE_VIEW = 'queue:view';
export const VECTOR_VIEW = 'vector:view';
export const TTS_VIEW = 'tts:view';
export const IMAGE_VIEW = 'image:view';
export const FILE_UPLOAD = 'file:upload';

// ============ 全部权限码列表 ============

export const ALL_PERMISSION_CODES: string[] = [
  POST_VIEW,
  POST_CREATE,
  POST_EDIT,
  POST_DELETE,
  POST_RESTORE,
  POST_HIDE,
  POST_VIEW_DELETED,
  COMMENT_MANAGE,
  COLLECTION_VIEW,
  COLLECTION_CREATE,
  COLLECTION_EDIT,
  COLLECTION_DELETE,
  CONFIG_VIEW,
  CONFIG_EDIT,
  USER_VIEW,
  USER_MANAGE,
  USER_ROLE_ASSIGN,
  QUEUE_VIEW,
  VECTOR_VIEW,
  TTS_VIEW,
  IMAGE_VIEW,
  FILE_UPLOAD,
];

// ============ 模块标签 ============

export const MODULE_LABELS: Record<string, string> = {
  post: "文章",
  comment: "评论",
  collection: "合集",
  config: "配置",
  user: "用户",
  tool: "工具",
};

export const MODULE_COLORS: Record<string, string> = {
  post: "blue",
  comment: "green",
  collection: "purple",
  config: "orange",
  user: "red",
  tool: "cyan",
};

// ============ 模块分组 ============

export const PERMISSION_MODULES: Record<string, string[]> = {
  post: [POST_VIEW, POST_CREATE, POST_EDIT, POST_DELETE, POST_RESTORE, POST_HIDE, POST_VIEW_DELETED],
  comment: [COMMENT_MANAGE],
  collection: [COLLECTION_VIEW, COLLECTION_CREATE, COLLECTION_EDIT, COLLECTION_DELETE],
  config: [CONFIG_VIEW, CONFIG_EDIT],
  user: [USER_VIEW, USER_MANAGE, USER_ROLE_ASSIGN],
  tool: [QUEUE_VIEW, VECTOR_VIEW, TTS_VIEW, IMAGE_VIEW, FILE_UPLOAD],
};
