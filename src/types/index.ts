/**
 * 类型定义
 * 重新导出共享的实体和 DTO
 */

// 实体（从 Prisma Client 导出）
export type { TbPost } from '@/generated/prisma-client';
export type { TbUser } from '@/generated/prisma-client';
export type { TbConfig } from '@/generated/prisma-client';

// DTO
export type {
  CreatePostDto,
  UpdatePostDto,
  ListPostDto,
  QueryCondition,
  PageQueryRes,
  SerializedPost,
} from '@/dto/post.dto';

export type {
  LoginDto,
  RegisterDto,
  UserInfo,
  LoginResponse,
  CreateUserDto,
  UpdateUserDto,
  QueryUserCondition,
} from '@/dto/user.dto';

export type {
  CreateConfigDto,
  UpdateConfigDto,
  QueryConfigCondition,
  PageQueryRes as ConfigPageQueryRes,
} from '@/dto/config.dto';

export type { ResponseBody } from '@/dto/response.dto';

// 角色相关类型
export {
  UserRole,
  RoleDisplayNames,
  RolePermissionsMap,
  hasPermission,
  isAdmin,
  getRoleOptions,
} from '@/types/role';
export type { RolePermissions } from '@/types/role';

// 前端使用的类型别名
import type { SerializedPost } from '@/dto/post.dto';
import type { TbUser } from '@/generated/prisma-client';
import type { TbConfig } from '@/generated/prisma-client';

/**
 * 前端使用的 Post 类型（序列化后的版本）
 * - date 和 updated 是 ISO 字符串格式
 * - tags 是数组格式
 */
export type Post = SerializedPost;
export type User = TbUser;
export type Config = TbConfig;
