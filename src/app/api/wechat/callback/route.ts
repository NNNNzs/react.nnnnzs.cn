/**
 * API 路由: /api/wechat/callback
 * 功能: 开放平台回调接口，处理扫码登录和微信绑定
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCallback } from '@/lib/open-platform';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { getPrisma } from '@/lib/prisma';
import { generateToken, storeToken } from '@/lib/auth';
import redisService from '@/lib/redis';

/**
 * 回调参数类型
 */
interface CallbackParams {
  action: 'login' | 'bind';
  userId?: number;
  redirectUrl?: string;
}

/**
 * 开放平台回调请求体
 */
interface CallbackBody {
  token: string;
  appKey: string;
  status: number;
  openId: string;
  scanData: {
    nickName: string;
    avatarUrl: string;
  };
  params: CallbackParams;
  timestamp: number;
}

/**
 * POST /api/wechat/callback
 * 开放平台回调接口
 *
 * 功能：
 * 1. 验证回调签名
 * 2. 根据 action 参数处理登录或绑定逻辑
 * 3. 更新 Redis 状态供前端轮询
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CallbackBody;
    const {
      token,
      appKey,
      status,
      openId,
      scanData,
      params,
    } = body;

    // 获取配置
    const prisma = await getPrisma();
    const configs = await prisma.tbConfig.findMany({
      where: {
        key: {
          in: ['OPEN_PLATFORM_APP_KEY', 'OPEN_PLATFORM_APP_SECRET'],
        },
        status: 1,
      },
    });

    const configMap = Object.fromEntries(
      configs.map((c) => [c.key, c.value])
    );

    const expectedAppKey = configMap.OPEN_PLATFORM_APP_KEY || '';
    const appSecret = configMap.OPEN_PLATFORM_APP_SECRET || '';

    // 验证签名
    const signature = request.headers.get('X-Signature');
    if (!signature || !verifyCallback(JSON.stringify(body), appSecret, signature)) {
      console.error('签名验证失败');
      return NextResponse.json(
        errorResponse('签名验证失败'),
        { status: 401 }
      );
    }

    // 验证 appKey
    if (appKey !== expectedAppKey) {
      console.error('appKey 不匹配', { received: appKey, expected: expectedAppKey });
      return NextResponse.json(
        errorResponse('appKey 不匹配'),
        { status: 403 }
      );
    }

    // 根据 action 处理不同逻辑
    if (params?.action === 'bind') {
      // 绑定微信场景
      const userId = params.userId;
      if (!userId) {
        return NextResponse.json(
          errorResponse('绑定场景缺少 userId'),
          { status: 400 }
        );
      }

      // 检查该 openid 是否已被其他用户绑定
      const existingUser = await prisma.tbUser.findFirst({
        where: { wx_open_id: openId },
      });

      if (existingUser && existingUser.id !== userId) {
        return NextResponse.json(
          errorResponse('该微信已被其他账号绑定'),
          { status: 400 }
        );
      }

      // 绑定微信到当前用户
      await prisma.tbUser.update({
        where: { id: userId },
        data: {
          wx_open_id: openId,
          avatar: scanData?.avatarUrl || existingUser?.avatar,
        },
      });

      // 更新 Redis 状态
      await redisService.set(
        `wechat_screen_key/${token}`,
        JSON.stringify({
          status: 1,
          action: 'bind',
          openId,
          scanData,
          message: '绑定成功',
        }),
        'EX',
        3600
      );

      return NextResponse.json(successResponse({
        action: 'bind',
        message: '绑定成功',
      }));
    } else {
      // 登录场景（默认）
      // 查找是否已有该 openid 的用户
      let user = await prisma.tbUser.findFirst({
        where: { wx_open_id: openId },
      });

      // 如果没有找到用户，创建新用户（自动注册）
      if (!user) {
        const { v4: uuidv4 } = await import('uuid');
        const account = `wx_${uuidv4().substring(0, 8)}`;

        user = await prisma.tbUser.create({
          data: {
            account,
            password: uuidv4(),
            nickname: scanData?.nickName || '微信用户',
            avatar: scanData?.avatarUrl || '',
            wx_open_id: openId,
            role: 'user',
            status: 1,
            registered_time: new Date(),
          },
        });
      }

      // 生成登录 token
      const loginToken = generateToken();
      await storeToken(loginToken, user);

      // 更新 Redis 状态
      await redisService.set(
        `wechat_screen_key/${token}`,
        JSON.stringify({
          status: 1,
          action: 'login',
          openId,
          userId: user.id,
          loginToken,
          scanData,
          message: '登录成功',
        }),
        'EX',
        3600
      );

      return NextResponse.json(successResponse({
        action: 'login',
        userId: user.id,
        loginToken,
      }));
    }
  } catch (error) {
    console.error('开放平台回调处理失败:', error);
    return NextResponse.json(
      errorResponse('回调处理失败'),
      { status: 500 }
    );
  }
}
