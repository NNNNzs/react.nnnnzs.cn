/**
 * 用户注册API
 * POST /api/user/register
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import {
  hashPassword,
  generateToken,
  storeToken,
  setAuthCookie,
} from '@/lib/auth';
import { getConfigByKey } from '@/services/config';
import { successResponse, errorResponse } from '@/dto/response.dto';

/** 邮箱验证 API 基地址 */
const EMAIL_API = process.env.NEXT_PUBLIC_API_URL || 'https://api.nnnnzs.cn';

export async function POST(request: NextRequest) {
  try {
    // 检查是否允许注册
    const allowRegisterConfig = await getConfigByKey('allow_register');

    if (
      !allowRegisterConfig ||
      allowRegisterConfig.status !== 1 ||
      allowRegisterConfig.value !== '1'
    ) {
      return NextResponse.json(errorResponse('当前系统不允许注册'), {
        status: 403,
      });
    }

    const body = await request.json();
    const { account, password, nickname, mail, phone, emailCode } = body;

    if (!account || !password || !nickname) {
      return NextResponse.json(errorResponse('账号、密码和昵称不能为空'), {
        status: 400,
      });
    }

    // 邮箱和验证码必须同时提供
    if (mail && !emailCode) {
      return NextResponse.json(errorResponse('请输入邮箱验证码'), {
        status: 400,
      });
    }

    if (!mail && emailCode) {
      return NextResponse.json(errorResponse('请输入邮箱地址'), {
        status: 400,
      });
    }

    // 如果提供了邮箱，必须验证验证码
    if (mail && emailCode) {
      try {
        const verifyRes = await fetch(`${EMAIL_API}/email/verify-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: mail, code: emailCode }),
        });
        const verifyData = await verifyRes.json();

        if (!verifyData.status) {
          return NextResponse.json(
            errorResponse(verifyData.message || '邮箱验证码错误或已过期'),
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(errorResponse('邮箱验证服务暂不可用'), {
          status: 500,
        });
      }
    }

    const prisma = await getPrisma();

    // 检查用户是否已存在
    const existingUser = await prisma.tbUser.findFirst({
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

    const newUser = await prisma.tbUser.create({
      data: {
        account,
        password: hashedPassword,
        nickname,
        mail: mail || null,
        phone: phone || null,
        role: 'user',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${account}`,
        registered_ip: clientIp,
        registered_time: new Date(),
        status: 1,
      },
    });

    // 生成Token
    const token = generateToken();
    await storeToken(token, newUser);

    // 返回用户信息（不包含密码）
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userInfo } = newUser;

    const response = NextResponse.json(
      successResponse({ token, userInfo }, '注册成功')
    );

    // 设置Cookie
    setAuthCookie(response, token);

    return response;
  } catch (error) {
    console.error('注册失败:', error);
    return NextResponse.json(errorResponse('注册失败'), { status: 500 });
  }
}
