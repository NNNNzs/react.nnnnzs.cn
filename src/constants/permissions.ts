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

// ============ 聊天记录模块 ============
export const CHAT_LOG_VIEW = 'chat:log:view';
export const CHAT_LOG_DELETE = 'chat:log:delete';

// ============ 内容创作模块 ============
export const CONTENT_VIEW = 'content:view';
export const CONTENT_CREATE = 'content:create';
export const CONTENT_EDIT = 'content:edit';
export const CONTENT_DELETE = 'content:delete';
