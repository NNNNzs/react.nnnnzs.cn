import { getPrisma } from '@/lib/prisma';
import { verifyPassword, generateToken, storeToken } from '@/lib/auth';
import { TbUser } from '@/generated/prisma-client/client';

export async function login(account: string, password: string): Promise<{ token: string; userInfo: Omit<TbUser, 'password'> } | null> {
  const prisma = await getPrisma();

  const user = await prisma.tbUser.findFirst({
    where: { account },
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

  // 生成Token
  const token = generateToken();
  await storeToken(token, user);

  // 返回用户信息（不包含密码）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _password, ...userInfo } = user;

  return { token, userInfo };
}
