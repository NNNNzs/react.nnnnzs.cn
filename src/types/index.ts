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
} from '@/dto/post.dto';

export type { LoginDto, RegisterDto, UserInfo, LoginResponse } from '@/dto/user.dto';

export type { CreateConfigDto, UpdateConfigDto, QueryConfigCondition, PageQueryRes as ConfigPageQueryRes } from '@/dto/config.dto';

export type { ResponseBody } from '@/dto/response.dto';

// 前端使用的类型别名
import type { TbPost } from '@/entities/post.entity';
import type { TbUser } from '@/entities/user.entity';
import type { TbConfig } from '@/entities/config.entity';

export type Post = TbPost;
export type User = TbUser;
export type Config = TbConfig;
