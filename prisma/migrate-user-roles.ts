/**
 * 用户角色数据迁移脚本
 *
 * 将现有的 TbUser.role 数据迁移到 TbUserRole 关联表
 *
 * 使用方式：npx tsx prisma/migrate-user-roles.ts
 */

import { createScriptPrismaClient } from '../scripts/prisma-client';

const prisma = createScriptPrismaClient();

async function main() {
  console.log('🚀 Starting user roles migration...\n');

  try {
    // 1. 获取所有用户
    const users = await prisma.tbUser.findMany({
      select: {
        id: true,
        account: true,
        nickname: true,
        role: true,
      },
    });

    console.log(`📊 Found ${users.length} users`);

    // 2. 获取角色映射
    const roles = await prisma.tbRole.findMany({
      select: {
        id: true,
        code: true,
      },
    });

    const roleMap = new Map(roles.map(r => [r.code, r.id]));

    console.log(`📋 Found ${roles.length} roles: ${roles.map(r => r.code).join(', ')}`);

    // 3. 迁移用户角色
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // 检查用户是否已有角色关联
        const existingUserRoles = await prisma.tbUserRole.findMany({
          where: { user_id: user.id },
        });

        if (existingUserRoles.length > 0) {
          console.log(`⏭️  User ${user.account} (ID: ${user.id}) already has roles, skipping`);
          skippedCount++;
          continue;
        }

        // 根据旧的 role 字段确定新角色
        let roleCode: string | null = null;

        if (user.role === 'admin') {
          roleCode = 'admin';
        } else if (user.role === 'user') {
          roleCode = 'user';
        }
        // guest 或其他角色不迁移

        if (roleCode && roleMap.has(roleCode)) {
          const roleId = roleMap.get(roleCode)!;

          await prisma.tbUserRole.create({
            data: {
              user_id: user.id,
              role_id: roleId,
            },
          });

          console.log(`✅ User ${user.account} (ID: ${user.id}) -> Role ${roleCode}`);
          migratedCount++;
        } else {
          console.log(`⚠️  User ${user.account} (ID: ${user.id}) has no valid role to migrate (role: ${user.role})`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to migrate user ${user.account} (ID: ${user.id}):`, error);
        errorCount++;
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`  - Total users: ${users.length}`);
    console.log(`  - Migrated: ${migratedCount}`);
    console.log(`  - Skipped: ${skippedCount}`);
    console.log(`  - Errors: ${errorCount}`);

    if (errorCount > 0) {
      console.log('\n⚠️  Some users failed to migrate. Please check the errors above.');
      process.exit(1);
    }

    console.log('\n✨ User roles migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
