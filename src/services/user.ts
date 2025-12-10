/**
 * 用户服务
 * 提供用户的增删改查功能
 */

import { getPrisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import type {
  QueryUserCondition,
  PageQueryRes,
  CreateUserDto,
  UpdateUserDto,
  UserInfo,
} from '@/dto/user.dto';
import { UserRole } from '@/types/role';

/**
 * 获取用户列表
 */
export async function getUserList(
  params: QueryUserCondition
): Promise<PageQueryRes<UserInfo>> {
  const { pageNum = 1, pageSize = 10, query = '', role, status } = params;

  const prisma = await getPrisma();

  // 构建查询条件
  const whereConditions: Record<string, unknown> = {};

  if (query) {
    whereConditions.OR = [
      { account: { contains: query } },
      { nickname: { contains: query } },
      { mail: { contains: query } },
    ];
  }

  if (role) {
    whereConditions.role = role;
  }

  if (status !== undefined) {
    whereConditions.status = status;
  }

  // 查询数据
  const [users, count] = await Promise.all([
    prisma.tbUser.findMany({
      where: whereConditions,
      orderBy: {
        id: 'desc',
      },
      take: pageSize,
      skip: (pageNum - 1) * pageSize,
    }),
    prisma.tbUser.count({ where: whereConditions }),
  ]);

  // 移除密码字段
  const record = users.map((user) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userInfo } = user;
    return userInfo;
  });

  return {
    record,
    total: count,
    pageNum,
    pageSize,
  };
}

/**
 * 根据 ID 获取用户
 */
export async function getUserById(id: number): Promise<UserInfo | null> {
  const prisma = await getPrisma();
  const user = await prisma.tbUser.findUnique({
    where: { id },
  });

  if (!user) {
    return null;
  }

  // 移除密码字段
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...userInfo } = user;
  return userInfo;
}

/**
 * 根据账号获取用户
 */
export async function getUserByAccount(
  account: string
): Promise<UserInfo | null> {
  const prisma = await getPrisma();
  const user = await prisma.tbUser.findFirst({
    where: { account },
  });

  if (!user) {
    return null;
  }

  // 移除密码字段
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...userInfo } = user;
  return userInfo;
}

/**
 * 创建用户
 */
export async function createUser(dto: CreateUserDto): Promise<UserInfo> {
  const prisma = await getPrisma();

  // 检查账号是否已存在
  const existingUser = await prisma.tbUser.findFirst({
    where: { account: dto.account },
  });

  if (existingUser) {
    throw new Error('账号已存在');
  }

  // 加密密码
  const hashedPassword = await hashPassword(dto.password);

  // 创建用户
  const user = await prisma.tbUser.create({
    data: {
      account: dto.account,
      password: hashedPassword,
      nickname: dto.nickname,
      role: dto.role || UserRole.USER,
      mail: dto.mail,
      phone: dto.phone,
      avatar: dto.avatar,
      status: dto.status ?? 1,
      registered_time: new Date(),
    },
  });

  // 移除密码字段
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...userInfo } = user;
  return userInfo;
}

/**
 * 更新用户
 */
export async function updateUser(
  id: number,
  dto: UpdateUserDto
): Promise<UserInfo> {
  const prisma = await getPrisma();

  // 检查用户是否存在
  const user = await prisma.tbUser.findUnique({
    where: { id },
  });

  if (!user) {
    throw new Error('用户不存在');
  }

  // 构建更新数据
  const updateData: Record<string, unknown> = {};

  if (dto.nickname !== undefined) {
    updateData.nickname = dto.nickname;
  }

  if (dto.role !== undefined) {
    updateData.role = dto.role;
  }

  if (dto.mail !== undefined) {
    updateData.mail = dto.mail;
  }

  if (dto.phone !== undefined) {
    updateData.phone = dto.phone;
  }

  if (dto.avatar !== undefined) {
    updateData.avatar = dto.avatar;
  }

  if (dto.status !== undefined) {
    updateData.status = dto.status;
  }

  // 如果更新密码，需要加密
  if (dto.password) {
    updateData.password = await hashPassword(dto.password);
  }

  // 更新用户
  const updatedUser = await prisma.tbUser.update({
    where: { id },
    data: updateData,
  });

  // 移除密码字段
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...userInfo } = updatedUser;
  return userInfo;
}

/**
 * 删除用户
 */
export async function deleteUser(id: number): Promise<void> {
  const prisma = await getPrisma();

  const user = await prisma.tbUser.findUnique({
    where: { id },
  });

  if (!user) {
    throw new Error('用户不存在');
  }

  // 不允许删除管理员账号
  if (user.role === UserRole.ADMIN) {
    throw new Error('不允许删除管理员账号');
  }

  await prisma.tbUser.delete({
    where: { id },
  });
}

/**
 * 重置用户密码
 */
export async function resetUserPassword(
  id: number,
  newPassword: string
): Promise<void> {
  const prisma = await getPrisma();

  const user = await prisma.tbUser.findUnique({
    where: { id },
  });

  if (!user) {
    throw new Error('用户不存在');
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.tbUser.update({
    where: { id },
    data: {
      password: hashedPassword,
    },
  });
}
