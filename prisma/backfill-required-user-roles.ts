/**
 * 一次性 RBAC 收口脚本：为没有角色关联的历史用户补齐 user 角色。
 * 可重复执行；不会修改已有单角色或多角色关系。
 *
 * 使用方式：npx tsx prisma/backfill-required-user-roles.ts
 */
import { createScriptPrismaClient } from '../scripts/prisma-client';
import { ADMIN_ROLE_CODE, DEFAULT_USER_ROLE_CODE } from '../src/constants/roles';

const prisma = createScriptPrismaClient();

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const defaultRole = await tx.tbRole.findUnique({
      where: { code: DEFAULT_USER_ROLE_CODE },
      select: { id: true, status: true },
    });
    if (!defaultRole || defaultRole.status !== 1) {
      throw new Error('默认角色 user 不存在或未启用，已终止补数');
    }

    const usersWithoutRoles = await tx.tbUser.findMany({
      where: { userRoles: { none: {} } },
      select: { id: true },
    });
    if (usersWithoutRoles.length > 0) {
      await tx.tbUserRole.createMany({
        data: usersWithoutRoles.map((user) => ({
          user_id: user.id,
          role_id: defaultRole.id,
        })),
      });
    }

    const [userCount, usersStillWithoutRoles, activeAdminCount] = await Promise.all([
      tx.tbUser.count(),
      tx.tbUser.count({ where: { userRoles: { none: {} } } }),
      tx.tbUser.count({
        where: {
          status: 1,
          userRoles: { some: { role: { code: ADMIN_ROLE_CODE, status: 1 } } },
        },
      }),
    ]);
    if (usersStillWithoutRoles !== 0) throw new Error('补数后仍存在无角色用户');
    if (activeAdminCount < 1) throw new Error('系统不存在启用的管理员用户');

    return { userCount, addedRelations: usersWithoutRoles.length, usersStillWithoutRoles, activeAdminCount };
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
