import type { Prisma, PrismaClient } from '@/generated/prisma-client/client';
import { prisma } from '@/lib/prisma';
import { ADMIN_ROLE_CODE, DEFAULT_USER_ROLE_CODE } from '@/constants/roles';
import type { UserInfo } from '@/dto/user.dto';

type RoleDbClient = PrismaClient | Prisma.TransactionClient;
type UserCreateData = Omit<Prisma.TbUserCreateInput, 'userRoles'>;

export async function getDefaultUserRole(client: RoleDbClient = prisma) {
  const role = await client.tbRole.findUnique({
    where: { code: DEFAULT_USER_ROLE_CODE },
    select: { id: true, code: true, name: true, status: true },
  });
  if (!role || role.status !== 1) {
    throw new Error('系统默认角色 user 不存在或已停用，请先修复角色配置');
  }
  return role;
}

export async function validateActiveRoleIds(client: RoleDbClient, roleIds: number[]) {
  const uniqueRoleIds = [...new Set(roleIds)];
  if (uniqueRoleIds.length === 0) throw new Error('用户至少需要一个角色');
  if (uniqueRoleIds.length !== roleIds.length) throw new Error('角色列表不能包含重复项');

  const roles = await client.tbRole.findMany({
    where: { id: { in: uniqueRoleIds }, status: 1 },
    select: { id: true, code: true, name: true, status: true },
  });
  if (roles.length !== uniqueRoleIds.length) throw new Error('部分角色不存在或已停用');
  return roles;
}

export async function createUserWithDefaultRole(data: UserCreateData) {
  return prisma.$transaction(async (tx) => {
    const defaultRole = await getDefaultUserRole(tx);
    const user = await tx.tbUser.create({
      data: {
        ...data,
        userRoles: { create: { role_id: defaultRole.id } },
      },
      include: {
        userRoles: {
          select: { role: { select: { id: true, code: true, name: true, status: true } } },
        },
      },
    });
    const { password: _password, userRoles, ...baseUser } = user;
    void _password;
    return { ...baseUser, roles: userRoles.map(({ role }) => role) } as UserInfo;
  });
}

export async function assertActiveAdminRemains(
  client: RoleDbClient,
  userId: number,
  nextStatus: number,
  nextRoleCodes: string[],
) {
  const currentAdmin = await client.tbUser.findFirst({
    where: {
      id: userId,
      status: 1,
      userRoles: { some: { role: { code: ADMIN_ROLE_CODE, status: 1 } } },
    },
    select: { id: true },
  });
  if (!currentAdmin) return;

  const remainsAdmin = nextStatus === 1 && nextRoleCodes.includes(ADMIN_ROLE_CODE);
  if (remainsAdmin) return;

  const otherActiveAdmin = await client.tbUser.findFirst({
    where: {
      id: { not: userId },
      status: 1,
      userRoles: { some: { role: { code: ADMIN_ROLE_CODE, status: 1 } } },
    },
    select: { id: true },
  });
  if (!otherActiveAdmin) throw new Error('系统必须至少保留一个启用的管理员用户');
}

export async function replaceUserRoles(
  client: Prisma.TransactionClient,
  userId: number,
  roleIds: number[],
  nextStatus: number,
) {
  const roles = await validateActiveRoleIds(client, roleIds);
  await assertActiveAdminRemains(client, userId, nextStatus, roles.map((role) => role.code));
  await client.tbUserRole.deleteMany({ where: { user_id: userId } });
  await client.tbUserRole.createMany({
    data: roleIds.map((roleId) => ({ user_id: userId, role_id: roleId })),
  });
}
