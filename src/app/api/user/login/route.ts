/**
 * 用户登录API
 * POST /api/user/login
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserRepository } from '@/lib/repositories';
import {
  successResponse,
  errorResponse,
  verifyPassword,
  generateToken,
  storeToken,
  TOKEN_KEY,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account, password } = body;

    if (!account || !password) {
      return NextResponse.json(errorResponse('账号和密码不能为空'), {
        status: 400,
      });
    }

    const userRepository = await getUserRepository();

    // 查找用户（需要包含 password 字段）
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
      return NextResponse.json(errorResponse('账号或密码错误'), {
        status: 401,
      });
    }

    // 验证密码
    const isPasswordValid = await verifyPassword(password, user.password || '');
    if (!isPasswordValid) {
      return NextResponse.json(errorResponse('账号或密码错误'), {
        status: 401,
      });
    }

    // 生成Token
    const token = generateToken();
    await storeToken(token, user);

    // 返回用户信息（不包含密码）
    const userInfo = { ...user };
    delete (userInfo as any).password;

    const response = NextResponse.json(
      successResponse({ token, userInfo }, '登录成功')
    );

    // 设置Cookie
    response.cookies.set(TOKEN_KEY, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7天
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('登录失败:', error);
    return NextResponse.json(errorResponse('登录失败'), { status: 500 });
  }
}
