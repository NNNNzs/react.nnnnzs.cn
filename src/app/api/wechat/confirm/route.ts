/**
 * API 路由: /api/wechat/confirm
 * 功能: 小程序端确认授权，传递用户信息
 */

import { NextRequest, NextResponse } from 'next/server';
import redisService from '@/lib/redis';
import { successResponse, errorResponse } from '@/dto/response.dto';
import { getPrisma } from '@/lib/prisma';
import { generateToken, storeToken } from '@/lib/auth';
import { UserRole } from '@/types/role';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/wechat/confirm
 * 小程序确认授权
 * 
 * 功能说明：
 * 1. 如果 openid 已经绑定了账号，直接登录
 * 2. 如果 openid 未绑定账号，则自动创建新账号
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, openid, nickName, avatarUrl } = body;

    if (!token) {
      return NextResponse.json(
        errorResponse('缺少 token 参数'),
        { status: 400 }
      );
    }

    if (!openid) {
      return NextResponse.json(
        errorResponse('缺少 openid 参数'),
        { status: 400 }
      );
    }

    // 检查 token 是否有效
    const infoStr = await redisService.get(`wechat_screen_key/${token}`);

    if (!infoStr) {
      return NextResponse.json(
        errorResponse('二维码已过期'),
        { status: 404 }
      );
    }

    const prisma = await getPrisma();

    // 查找是否已有该 openid 的用户
    let user = await prisma.tbUser.findFirst({
      where: { wx_open_id: openid },
    });

    // 如果没有找到用户，创建新用户（自动注册）
    if (!user) {
      // 生成唯一的账号（使用 uuid 的前 8 位）
      const account = `wx_${uuidv4().substring(0, 8)}`;
      
      // 创建新用户
      user = await prisma.tbUser.create({
        data: {
          account,
          password: uuidv4(), // 生成随机密码（用户通过微信登录，不需要密码）
          nickname: nickName || '微信用户',
          avatar: avatarUrl || '',
          wx_open_id: openid,
          role: UserRole.USER,
          status: 1,
          registered_time: new Date(),
        },
      });

      console.log('✅ 新用户自动注册成功:', user.account);
    }

    // 生成登录 token
    const loginToken = generateToken();
    await storeToken(loginToken, user);

    // 更新 Redis 中的信息
    const info = JSON.parse(infoStr);
    info.status = 1; // 已授权
    info.openid = openid;
    info.nickName = nickName;
    info.avatarUrl = avatarUrl;
    info.userId = user.id;
    info.loginToken = loginToken;

    await redisService.set(
      `wechat_screen_key/${token}`,
      JSON.stringify(info),
      'EX',
      3600
    );

    return NextResponse.json(successResponse({ msg: '授权成功' }));
  } catch (error) {
    console.error('确认授权失败:', error);
    return NextResponse.json(
      errorResponse('确认授权失败'),
      { status: 500 }
    );
  }
}
