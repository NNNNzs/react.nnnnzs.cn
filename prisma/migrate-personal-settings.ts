/**
 * 个人设置数据迁移。
 * 在执行 `pnpm prisma:push` 后运行：既有邮箱保留为已验证，
 * 历史微信快捷登录账号的随机明文密码改为未设置密码。
 */

import { createScriptPrismaClient } from '../scripts/prisma-client';

const prisma = createScriptPrismaClient();

async function main() {
  const verified = await prisma.tbUser.updateMany({
    where: { mail: { not: null }, mail_verified_at: null },
    data: { mail_verified_at: new Date() },
  });
  const wechatUsers = await prisma.tbUser.findMany({
    where: { wx_open_id: { not: null }, account: { startsWith: 'wx_' } },
    select: { id: true, password: true },
  });
  // 只清理旧逻辑保存的 UUID 明文，绝不覆盖用户后来主动设置的 bcrypt 密码。
  const legacyPasswordIds = wechatUsers
    .filter((user) => user.password && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.password))
    .map((user) => user.id);
  const passwordlessWechat = legacyPasswordIds.length
    ? await prisma.tbUser.updateMany({ where: { id: { in: legacyPasswordIds } }, data: { password: null } })
    : { count: 0 };
  console.log(`个人设置迁移完成：标记 ${verified.count} 个历史邮箱，清除 ${passwordlessWechat.count} 个微信账户密码。`);
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
