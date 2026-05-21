/**
 * API 路由: /api/wechat/status
 * 功能: 查询扫码状态，如果扫码成功则执行登录/注册逻辑
 */

import { NextRequest, NextResponse } from 'next/server';
import { callOpenPlatformAPI } from '@/lib/open-platform';
import { successResponse, errorResponse } from '@/dto/response.dto';
import redisService from '@/lib/redis';
import { getPrisma } from '@/lib/prisma';
import { generateToken, storeToken } from '@/lib/auth';

/**
 * 微信扫码状态响应数据
 */
interface WeChatStatusData {
  scanStatus: number;
  status?: number;
  openId: string;
  scanData?: {
    avatarUrl?: string;
    nickName?: string;
  };
  params?: {
    action?: string;
    userId?: number;
  };
}

/**
 * GET /api/wechat/status?token=xxx
 * 查询扫码状态
 *
 * 1. 先检查本地 Redis 是否已有登录结果
 * 2. 如果没有，调用开放平台 API 查询扫码状态
 * 3. 如果扫码成功，在 React 后端执行登录/注册逻辑
 * 4. 将结果缓存到 Redis，避免重复处理
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        errorResponse('缺少 token 参数'),
        { status: 400 }
      );
    }

    // 先检查本地 Redis 是否已有登录结果
    const cachedResult = await redisService.get(`wechat_login_result_${token}`);
    if (cachedResult) {
      const result = JSON.parse(cachedResult);
      console.log('[开放平台] 从本地缓存获取登录结果:', result);
      return NextResponse.json(successResponse(result));
    }

    // 调用开放平台 API 查询状态
    const data = await callOpenPlatformAPI<WeChatStatusData>(`/qr/status?token=${token}`, 'GET');
    console.log('[开放平台] 后端返回状态:', data);

    // 如果扫码成功，执行登录/注册逻辑
    if (data.scanStatus === 1 || data.status === 1) {
      const prisma = await getPrisma();
      const { openId, scanData, params } = data;

      if (params?.action === 'bind') {
        // 绑定场景
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
          // 缓存错误结果，避免重复查询
          const errorResult = {
            status: false,
            message: '该微信已被其他账号绑定',
            scanStatus: 1,
            action: 'bind',
          };
          await redisService.set(
            `wechat_login_result_${token}`,
            JSON.stringify(errorResult),
            'EX',
            3600
          );
          // 返回 HTTP 200，但在响应体中标记失败
          return NextResponse.json(successResponse(errorResult));
        }

        // 绑定微信到当前用户
        await prisma.tbUser.update({
          where: { id: userId },
          data: {
            wx_open_id: openId,
            avatar: scanData?.avatarUrl || existingUser?.avatar,
          },
        });

        const result = {
          ...data,
          action: 'bind',
          message: '绑定成功',
        };

        // 缓存结果
        await redisService.set(
          `wechat_login_result_${token}`,
          JSON.stringify(result),
          'EX',
          3600
        );

        return NextResponse.json(successResponse(result));
      } else {
        // 登录场景
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

        const result = {
          ...data,
          action: 'login',
          loginToken,
          userId: user.id,
          message: '登录成功',
        };

        // 缓存结果
        await redisService.set(
          `wechat_login_result_${token}`,
          JSON.stringify(result),
          'EX',
          3600
        );

        return NextResponse.json(successResponse(result));
      }
    }

    // 扫码未完成，返回原始状态
    return NextResponse.json(successResponse(data));
  } catch (error) {
    console.error('查询状态失败:', error);
    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '查询状态失败'),
      { status: 500 }
    );
  }
}
