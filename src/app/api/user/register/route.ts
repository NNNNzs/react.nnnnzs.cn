/**
 * 用户注册API
 * POST /api/user/register
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserRepository } from '@/lib/repositories';
import {
  successResponse,
  errorResponse,
  hashPassword,
  generateToken,
  storeToken,
  TOKEN_KEY,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account, password, nickname, mail, phone } = body;

    if (!account || !password || !nickname) {
      return NextResponse.json(errorResponse('账号、密码和昵称不能为空'), {
        status: 400,
      });
    }

    const userRepository = await getUserRepository();

    // 检查用户是否已存在
    const existingUser = await userRepository.findOne({
      where: { account },
    });

    if (existingUser) {
      return NextResponse.json(errorResponse('账号已存在'), { status: 400 });
    }

    // 加密密码
    const hashedPassword = await hashPassword(password);

    // 创建用户
    const xForwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const clientIp = (xForwardedFor?.split(',')[0]?.trim() || realIp || '127.0.0.1');

    const newUser = await userRepository.save({
      account,
      password: hashedPassword,
      nickname,
      mail: mail || '',
      phone: phone || '',
      role: 'user',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${account}`,
      registered_ip: clientIp,
      registered_time: new Date(),
      status: 1,
    });

    // 生成Token
    const token = generateToken();
    await storeToken(token, newUser);

    // 返回用户信息（不包含密码）
    const { password: _password, ...userInfo } = newUser as import('@/entities/user.entity').TbUser & {
      password?: string;
    };

    const response = NextResponse.json(
      successResponse({ token, userInfo }, '注册成功')
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
    console.error('注册失败:', error);
    return NextResponse.json(errorResponse('注册失败'), { status: 500 });
  }
}
