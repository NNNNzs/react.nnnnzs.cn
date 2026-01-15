/**
 * OAuth 2.0 Token Revocation Endpoint (根路径)
 * 符合 RFC 7009 标准
 */

import { NextRequest, NextResponse } from 'next/server';
import RedisService from '@/lib/redis';
import { deleteLongTermToken } from '@/services/token';
import { getPrisma } from '@/lib/prisma';

/**
 * 撤销 Token
 * 支持三种类型的 Token：
 * 1. 普通登录 Token：存储在 user:${token}
 * 2. OAuth Token：存储在 token:${token}
 * 3. 长期 Token：存储在数据库中，格式为 LTK_${uuid}
 */
async function revokeToken(token: string): Promise<boolean> {
  if (!token) {
    return false;
  }

  let revoked = false;

  // 1. 尝试删除普通登录 Token (user:${token})
  const userTokenKey = `user:${token}`;
  const userTokenDeleted = await RedisService.del(userTokenKey);
  if (userTokenDeleted > 0) {
    console.log('✅ [OAuth Revoke] 已删除普通登录 Token');
    revoked = true;
  }

  // 2. 尝试删除 OAuth Token (token:${token})
  const oauthTokenKey = `token:${token}`;
  const oauthTokenDeleted = await RedisService.del(oauthTokenKey);
  if (oauthTokenDeleted > 0) {
    console.log('✅ [OAuth Revoke] 已删除 OAuth Token');
    revoked = true;
  }

  // 3. 如果是长期 Token (LTK_*)，从数据库删除
  if (token.startsWith('LTK_')) {
    try {
      const prisma = await getPrisma();
      const result = await prisma.longTermToken.deleteMany({
        where: { token }
      });
      if (result.count > 0) {
        console.log('✅ [OAuth Revoke] 已删除长期 Token');
        revoked = true;
      }
    } catch (error) {
      console.error('❌ [OAuth Revoke] 删除长期 Token 失败:', error);
    }
  }

  return revoked;
}

export async function POST(request: NextRequest) {
  try {
    // 支持 application/json 和 application/x-www-form-urlencoded
    let body: Record<string, string>;
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries()) as Record<string, string>;
    }

    const { token, token_type_hint } = body;

    if (!token) {
      return NextResponse.json({
        error: 'invalid_request',
        error_description: 'token parameter is required'
      }, { status: 400 });
    }

    console.log('📝 [OAuth Revoke] 撤销请求:', {
      token: token.substring(0, 20) + '...',
      token_type_hint: token_type_hint || 'auto-detect',
      type: token.startsWith('LTK_') ? 'long-term' : 'regular'
    });

    // 执行撤销
    const revoked = await revokeToken(token);

    // RFC 7009: 即使 token 不存在，也要返回成功（防止信息泄露）
    // 但我们在日志中记录实际结果
    if (!revoked) {
      console.log('⚠️ [OAuth Revoke] Token 未找到或已被撤销');
    }

    // 总是返回成功（符合 RFC 7009）
    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('❌ [OAuth Revoke] 撤销失败:', error);
    return NextResponse.json({
      error: 'invalid_request',
      error_description: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/revoke',
    description: 'OAuth 2.0 Token Revocation',
    method: 'POST'
  });
}
