import { getPrisma } from '@/lib/prisma';
import { verifyPassword, generateToken, storeToken } from '@/lib/auth';
import type { UserInfo } from '@/dto/user.dto';

export async function login(account: string, password: string): Promise<{ token: string; userInfo: UserInfo } | null> {
  const prisma = await getPrisma();

  const user = await prisma.tbUser.findFirst({
    where: { account },
    include: {
      userRoles: {
        select: { role: { select: { id: true, code: true, name: true, status: true } } },
      },
    },
  });

  if (!user) {
    return null;
  }

  if (!user.password) {
    throw new Error('该账号尚未设置登录密码，请使用已绑定的快捷登录方式进入个人设置后初始化密码');
  }

  // 验证密码
  const isPasswordValid = await verifyPassword(password, user.password);
  if (!isPasswordValid) {
    return null;
  }

  // 返回用户信息（不包含密码）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _password, userRoles, ...baseUserInfo } = user;
  const userInfo: UserInfo = {
    ...baseUserInfo,
    roles: userRoles.map(({ role }) => role),
  };

  const token = generateToken();
  await storeToken(token, userInfo);

  return { token, userInfo };
}
