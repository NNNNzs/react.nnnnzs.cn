import { getUserRepository } from '@/lib/repositories';
import { verifyPassword, generateToken, storeToken } from '@/lib/auth';
import { TbUser } from '@/entities/user.entity';

export async function login(account: string, password: string): Promise<{ token: string; userInfo: Omit<TbUser, 'password'> } | null> {
  const userRepository = await getUserRepository();

  const user = await userRepository.findOne({
    where: { account },
    select: [
      'id',
      'role',
      'account',
      'avatar',
      'password',
      'nickname',
      'mail',
      'phone',
      'registered_ip',
      'registered_time',
      'dd_id',
      'github_id',
      'work_wechat_id',
      'status',
    ],
  });

  if (!user) {
    return null;
  }

  // 验证密码
  const isPasswordValid = await verifyPassword(password, user.password || '');
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
