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
import { Prisma } from '@/generated/prisma-client/client';
import {
  assertActiveAdminRemains,
  getDefaultUserRole,
  replaceUserRoles,
  validateActiveRoleIds,
} from '@/services/user-role';

const userRoleSelect = {
  userRoles: {
    select: {
      role: { select: { id: true, code: true, name: true, status: true } },
    },
  },
} as const;

function toUserInfo<T extends { password: string | null; userRoles: Array<{ role: UserInfo['roles'][number] }> }>(user: T): UserInfo {
  const { password: _password, userRoles, ...userInfo } = user;
  void _password;
  return { ...userInfo, roles: userRoles.map(({ role }) => role) } as unknown as UserInfo;
}

/**
 * 获取用户列表
 */
export async function getUserList(
  params: QueryUserCondition
): Promise<PageQueryRes<UserInfo>> {
  const { pageNum = 1, pageSize = 10, query = '', role_id, status } = params;

  const prisma = await getPrisma();

  // 构建查询条件
  const whereConditions: Prisma.TbUserWhereInput = {};

  if (query) {
    whereConditions.OR = [
      { account: { contains: query } },
      { nickname: { contains: query } },
      { mail: { contains: query } },
    ];
  }

  if (role_id) {
    whereConditions.userRoles = { some: { role_id } };
  }

  if (status !== undefined) {
    whereConditions.status = status;
  }

  // 查询数据
  const [users, count] = await Promise.all([
    prisma.tbUser.findMany({
      where: whereConditions,
      include: userRoleSelect,
      orderBy: {
        id: 'desc',
      },
      take: pageSize,
      skip: (pageNum - 1) * pageSize,
    }),
    prisma.tbUser.count({ where: whereConditions }),
  ]);

  // 移除密码字段
  const record = users.map(toUserInfo);

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
    include: userRoleSelect,
  });

  if (!user) {
    return null;
  }

  return toUserInfo(user);
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
    include: userRoleSelect,
  });

  if (!user) {
    return null;
  }

  return toUserInfo(user);
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

  return prisma.$transaction(async (tx) => {
    const roleIds = dto.role_ids ?? [(await getDefaultUserRole(tx)).id];
    await validateActiveRoleIds(tx, roleIds);
    const user = await tx.tbUser.create({
      data: {
        account: dto.account,
        password: hashedPassword,
        nickname: dto.nickname,
        mail: dto.mail,
        phone: dto.phone,
        avatar: dto.avatar,
        status: dto.status ?? 1,
        registered_time: new Date(),
        userRoles: { create: roleIds.map((role_id) => ({ role_id })) },
      },
      include: userRoleSelect,
    });
    return toUserInfo(user);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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

  const updateData: Prisma.TbUserUpdateInput = {};

  if (dto.nickname !== undefined) {
    updateData.nickname = dto.nickname;
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

  return prisma.$transaction(async (tx) => {
    const currentRoles = await tx.tbUserRole.findMany({
      where: { user_id: id },
      select: { role_id: true, role: { select: { code: true, status: true } } },
    });
    const nextStatus = dto.status ?? user.status;
    if (dto.role_ids !== undefined) {
      await replaceUserRoles(tx, id, dto.role_ids, nextStatus);
    } else {
      const activeRoleCodes = currentRoles.filter(({ role }) => role.status === 1).map(({ role }) => role.code);
      if (activeRoleCodes.length === 0) throw new Error('用户至少需要一个启用角色');
      await assertActiveAdminRemains(tx, id, nextStatus, activeRoleCodes);
    }
    const updatedUser = await tx.tbUser.update({
      where: { id },
      data: updateData,
      include: userRoleSelect,
    });
    return toUserInfo(updatedUser);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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

  await prisma.$transaction(async (tx) => {
    const roles = await tx.tbUserRole.findMany({
      where: { user_id: id },
      select: { role: { select: { code: true } } },
    });
    await assertActiveAdminRemains(tx, id, 0, roles.map(({ role }) => role.code));
    await tx.tbUser.delete({ where: { id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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

/** 更新用户的基础资料，不包含邮箱和密码等敏感字段 */
export async function updateUserProfile(
  id: number,
  dto: Pick<UpdateUserDto, 'nickname' | 'phone' | 'avatar'>,
): Promise<UserInfo> {
  return updateUser(id, dto);
}

/** 写入已验证的邮箱地址 */
export async function updateVerifiedUserEmail(id: number, mail: string): Promise<UserInfo> {
  const prisma = await getPrisma();
  const user = await prisma.tbUser.update({
    where: { id },
    data: { mail, mail_verified_at: new Date() },
    include: userRoleSelect,
  });
  return toUserInfo(user);
}

/** 解除邮箱绑定 */
export async function clearUserEmail(id: number): Promise<UserInfo> {
  const prisma = await getPrisma();
  const user = await prisma.tbUser.update({
    where: { id },
    data: { mail: null, mail_verified_at: null },
    include: userRoleSelect,
  });
  return toUserInfo(user);
}

/** 获取密码与邮箱安全状态，仅供已认证的安全接口使用 */
export async function getUserSecurityState(id: number) {
  const prisma = await getPrisma();
  return prisma.tbUser.findUnique({
    where: { id },
    select: { password: true, mail: true, mail_verified_at: true },
  });
}
