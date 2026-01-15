/**
 * OAuth Token管理API
 * GET /api/user/token/oauth - 获取用户OAuth Token列表
 * DELETE /api/user/token/oauth - 删除OAuth Token
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTokenFromRequest,
  validateToken,
} from '@/lib/auth';
import redis from '@/lib/redis';
import { successResponse, errorResponse } from '@/dto/response.dto';

/**
 * OAuth Token数据结构
 * 注意：userId可能是string或number（向后兼容）
 */
interface OAuthTokenData {
  userId: string | number;
  scope: string;
  client_id: string;
  created_at: number;
  is_permanent?: boolean;
  duration?: number;
}

/**
 * OAuth Token列表项
 */
interface OAuthTokenItem {
  token: string;
  client_id: string;
  scope: string;
  created_at: number;
  expires_at: number | null;
  is_permanent: boolean;
  duration: number | null;
}

/**
 * 获取用户OAuth Token列表
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const token = getTokenFromRequest(request.headers);
    if (!token) {
      return NextResponse.json(
        errorResponse('未登录'),
        { status: 401 }
      );
    }

    const user = await validateToken(token);
    if (!user) {
      return NextResponse.json(
        errorResponse('Token无效或已过期'),
        { status: 401 }
      );
    }

    // 获取所有OAuth token的key（格式：token:${token}）
    const tokenKeys = await redis.keys('token:*');
    const userTokens: OAuthTokenItem[] = [];

    // 遍历所有token，过滤出属于当前用户的
    for (const key of tokenKeys) {
      const tokenDataStr = await redis.get(key);
      if (!tokenDataStr) continue;

      try {
        const tokenData: OAuthTokenData = JSON.parse(tokenDataStr);
        
        // 只返回属于当前用户的token（确保类型一致，都转为字符串比较）
        const tokenUserId = typeof tokenData.userId === 'number' 
          ? tokenData.userId.toString() 
          : tokenData.userId;
        if (tokenUserId === user.id.toString()) {
          const token = key.replace('token:', '');
          
          // 计算过期时间
          let expires_at: number | null = null;
          if (!tokenData.is_permanent && tokenData.duration) {
            const createdTime = tokenData.created_at || Date.now();
            expires_at = Math.floor((createdTime + tokenData.duration * 24 * 60 * 60 * 1000) / 1000);
          }

          userTokens.push({
            token,
            client_id: tokenData.client_id || 'unknown',
            scope: tokenData.scope || 'read',
            created_at: tokenData.created_at || Date.now(),
            expires_at,
            is_permanent: tokenData.is_permanent || false,
            duration: tokenData.duration || null,
          });
        }
      } catch (error) {
        // 跳过解析失败的token数据
        console.error(`解析token数据失败 (${key}):`, error);
        continue;
      }
    }

    // 按创建时间倒序排序
    userTokens.sort((a, b) => b.created_at - a.created_at);

    return NextResponse.json(
      successResponse(userTokens, '获取成功')
    );
  } catch (error) {
    console.error('获取OAuth Token列表失败:', error);
    const errorMessage = error instanceof Error ? error.message : '获取OAuth Token列表失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}

/**
 * 删除OAuth Token
 */
export async function DELETE(request: NextRequest) {
  try {
    // 验证用户身份
    const token = getTokenFromRequest(request.headers);
    if (!token) {
      return NextResponse.json(
        errorResponse('未登录'),
        { status: 401 }
      );
    }

    const user = await validateToken(token);
    if (!user) {
      return NextResponse.json(
        errorResponse('Token无效或已过期'),
        { status: 401 }
      );
    }

    // 获取要删除的token
    const { searchParams } = new URL(request.url);
    const tokenToDelete = searchParams.get('token');

    if (!tokenToDelete) {
      return NextResponse.json(
        errorResponse('Token必填'),
        { status: 400 }
      );
    }

    // 验证token是否属于当前用户
    const tokenKey = `token:${tokenToDelete}`;
    const tokenDataStr = await redis.get(tokenKey);
    
    if (!tokenDataStr) {
      return NextResponse.json(
        errorResponse('Token不存在或已过期'),
        { status: 404 }
      );
    }

    try {
      const tokenData: OAuthTokenData = JSON.parse(tokenDataStr);
      
      // 验证token是否属于当前用户（确保类型一致，都转为字符串比较）
      const tokenUserId = typeof tokenData.userId === 'number' 
        ? tokenData.userId.toString() 
        : tokenData.userId;
      if (tokenUserId !== user.id.toString()) {
        return NextResponse.json(
          errorResponse('无权删除此Token'),
          { status: 403 }
        );
      }

      // 删除token
      await redis.del(tokenKey);

      return NextResponse.json(
        successResponse(null, '删除成功')
      );
    } catch (error) {
      console.error('解析token数据失败:', error);
      return NextResponse.json(
        errorResponse('Token数据格式错误'),
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('删除OAuth Token失败:', error);
    const errorMessage = error instanceof Error ? error.message : '删除OAuth Token失败';
    return NextResponse.json(errorResponse(errorMessage), { status: 500 });
  }
}
