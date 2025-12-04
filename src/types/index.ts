/**
 * 类型定义
 * 重新导出共享的实体和 DTO
 */

// 实体
export type { TbPost } from '@/entities/post.entity';
export type { TbUser } from '@/entities/user.entity';
export type { TbConfig } from '@/entities/config.entity';

// DTO
export type {
  CreatePostDto,
  UpdatePostDto,
  ListPostDto,
  QueryCondition,
  PageQueryRes,
  SerializedPost,
} from '@/dto/post.dto';

export type { LoginDto, RegisterDto, UserInfo, LoginResponse } from '@/dto/user.dto';

export type { CreateConfigDto, UpdateConfigDto, QueryConfigCondition, PageQueryRes as ConfigPageQueryRes } from '@/dto/config.dto';

export type { ResponseBody } from '@/dto/response.dto';

// 前端使用的类型别名
import type { SerializedPost } from '@/dto/post.dto';
import type { TbUser } from '@/entities/user.entity';
import type { TbConfig } from '@/entities/config.entity';

/**
 * 前端使用的 Post 类型（序列化后的版本）
 * - date 和 updated 是 ISO 字符串格式
 * - tags 是数组格式
 */
export type Post = SerializedPost;
export type User = TbUser;
export type Config = TbConfig;
