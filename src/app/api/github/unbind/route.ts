/**
 * GitHub 账号解绑路由
 * 路由: /api/github/unbind
 * 解除 GitHub 账号绑定
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, getUserFromToken, storeToken } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/dto/response.dto';

/**
 * POST /api/github/unbind
 * 解除 GitHub 账号绑定
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户登录状态
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json(
        errorResponse('未登录或登录已过期'),
        { status: 401 }
      );
    }
    
    const prisma = await getPrisma();
    
    // 解绑 GitHub 账号
    const updatedUser = await prisma.tbUser.update({
      where: { id: user.id },
      data: {
        github_id: null,
        github_username: null,
        github_access_token: null,
      },
    });

    // 更新当前 token 在 Redis 中的用户信息，保证 /api/user/info 立即返回最新数据
    const token = getTokenFromRequest(request.headers);
    if (token) {
      await storeToken(token, updatedUser as never);
    }
    
    return NextResponse.json(
      successResponse(
        {
          id: updatedUser.id,
          account: updatedUser.account,
          nickname: updatedUser.nickname,
          github_id: updatedUser.github_id,
          github_username: updatedUser.github_username,
        },
        '解绑成功'
      )
    );
  } catch (error) {
    console.error('GitHub 解绑失败:', error);
    return NextResponse.json(
      errorResponse('解绑失败'),
      { status: 500 }
    );
  }
}
