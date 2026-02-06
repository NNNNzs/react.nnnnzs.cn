/**
 * MCP 认证适配器
 * 将标准 OAuth 2.0 Bearer Token 适配到 MCP 认证流程
 * 兼容 Claude Code CLI 和 MCP SDK 的 OAuth 2.0 标准
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateToken, getTokenFromRequest } from '@/lib/auth';
import { validateLongTermToken } from '@/services/token';

// 定义 AuthInfo 类型，符合 MCP SDK 标准
export interface AuthInfo {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt?: number;
  resource?: URL;
  extra?: Record<string, unknown>;
}

// OAuth 2.0 令牌响应类型
export interface OAuthTokens {
  access_token: string;
  token_type: 'Bearer';
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

// OAuth 2.0 错误响应类型
export interface OAuthErrorResponse {
  error: string;
  error_description?: string;
  error_uri?: string;
}

/**
 * MCP Token 验证器接口
 * 用于 MCP SDK 的 OAuth 2.0 Bearer Token 验证
 */
export interface OAuthTokenVerifier {
  verifyAccessToken(token: string): Promise<AuthInfo>;
}

/**
 * MCP 认证适配器
 * 实现标准 OAuth 2.0 Bearer Token 验证
 */
export const mcpAuthVerifier: OAuthTokenVerifier = {
  /**
   * 验证访问令牌
   * @param token Bearer Token
   * @returns AuthInfo 对象
   */
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    // 使用现有的 token 验证函数
    const user = await validateToken(token);

    if (!user) {
      throw new Error("Invalid or expired token");
    }

    // 构建标准的 AuthInfo 对象
    return {
      token,
      clientId: `mcp-client-${user.id}`,
      scopes: ['read', 'write'], // 根据用户角色动态设置
      expiresAt: undefined, // 使用现有 Redis 过期机制
      extra: {
        userId: user.id,
        role: user.role || 'user',
        account: user.account
      }
    };
  }
};

/**
 * 从请求头中提取并验证 Bearer Token
 * 支持标准 OAuth 2.0 Bearer Token 认证
 * @param requestOrHeaders 请求对象或请求头
 * @returns 认证结果，包含用户信息或错误
 */
export async function authenticateMcpRequest(
  requestOrHeaders: NextRequest | Headers
): Promise<{ success: boolean; user?: import('@/types').User; error?: string }> {
  const headers = requestOrHeaders instanceof Headers
    ? requestOrHeaders
    : requestOrHeaders.headers;
  const token = getTokenFromRequest(headers);

  // 使用标准 Bearer Token
  if (token) {
    const user = await validateToken(token);
    if (user) {
      return { success: true, user };
    }
    return { success: false, error: "Invalid or expired token" };
  }

  return {
    success: false,
    error: "Missing authentication credentials. Please provide 'Authorization: Bearer <token>' header"
  };
}

/**
 * 创建认证错误响应
 * @param message 错误消息
 * @returns 标准错误对象
 */
export function createAuthError(message: string) {
  return {
    isError: true,
    content: [{ type: "text", text: message }]
  };
}

/**
 * 解析 OAuth Token 请求体
 * 支持 application/json 和 application/x-www-form-urlencoded
 */
async function parseTokenRequestBody(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') || '';
  
  if (contentType.includes('application/x-www-form-urlencoded')) {
    // 解析表单数据
    const text = await request.text();
    const params = new URLSearchParams(text);
    const body: Record<string, string> = {};
    params.forEach((value, key) => {
      body[key] = value;
    });
    return body;
  } else {
    // 解析 JSON 数据
    return await request.json();
  }
}

/**
 * OAuth 2.0 Token 端点处理器
 * 支持多种认证方式：普通 Token、长期 Token、客户端凭证、授权码
 * 支持 Content-Type: application/json 和 application/x-www-form-urlencoded
 */
export async function handleOAuthTokenRequest(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await parseTokenRequestBody(request);
    const {
      grant_type,
      client_id,
      client_secret,
      code,
      redirect_uri,
      code_verifier,
      refresh_token,
      scope
    } = body;

    console.log('📥 [OAuth Token] 收到 token 请求:', {
      grant_type,
      client_id,
      has_code: !!code,
      has_redirect_uri: !!redirect_uri,
      has_code_verifier: !!code_verifier,
      scope
    });

    // 支持的授权类型
    switch (grant_type) {
      case 'client_credentials':
        console.log('🔑 [OAuth Token] 处理 client_credentials 授权');
        return await handleClientCredentialsGrant(request);

      case 'authorization_code':
        console.log('🔑 [OAuth Token] 处理 authorization_code 授权');
        return await handleAuthorizationCodeGrant(code, client_id, client_secret, redirect_uri, code_verifier);

      case 'refresh_token':
        console.log('🔑 [OAuth Token] 处理 refresh_token 授权');
        return await handleRefreshTokenGrant(refresh_token, scope);

      default:
        console.error('❌ [OAuth Token] 不支持的授权类型:', grant_type);
        return NextResponse.json({
          error: 'unsupported_grant_type',
          error_description: `Grant type '${grant_type}' is not supported`
        }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ [OAuth Token] 处理失败:', error);
    return NextResponse.json({
      error: 'invalid_request',
      error_description: error instanceof Error ? error.message : 'Invalid request'
    }, { status: 400 });
  }
}

/**
 * 处理客户端凭证授权
 * 适用于服务器到服务器的认证
 */
async function handleClientCredentialsGrant(request: NextRequest): Promise<NextResponse> {
  // 从 Authorization header 或 body 获取凭证
  const token = getTokenFromRequest(request.headers);

  if (!token) {
    return NextResponse.json({
      error: 'invalid_client',
      error_description: 'Client credentials required'
    }, { status: 401 });
  }

  // 验证 Token
  const user = await validateToken(token);
  if (!user) {
    return NextResponse.json({
      error: 'invalid_client',
      error_description: 'Invalid client credentials'
    }, { status: 401 });
  }

  // 检查是否为长期 Token
  const userId = user.id.toString();
  const tokenType = 'regular';
  let expiresIn: number | undefined = 7 * 24 * 60 * 60; // 默认7天

  if (token.startsWith('LTK_')) {
    const longTermUserId = await validateLongTermToken(token);
    if (!longTermUserId) {
      return NextResponse.json({
        error: 'invalid_token',
        error_description: 'Token expired or invalid'
      }, { status: 401 });
    }
    void userId;
    void tokenType;
    expiresIn = undefined; // 长期token没有固定过期时间
  } else {
    // 对于普通token，检查是否是永久token
    const redis = (await import('@/lib/redis')).default;
    const tokenDataStr = await redis.get(`token:${token}`);
    if (tokenDataStr) {
      const tokenData = JSON.parse(tokenDataStr);
      if (tokenData.is_permanent) {
        expiresIn = undefined; // 永久token
      } else if (tokenData.duration) {
        expiresIn = tokenData.duration * 24 * 60 * 60;
      }
    }
  }

  // 生成 OAuth 响应
  const response: OAuthTokens = {
    access_token: token,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: 'read write',
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache'
    }
  });
}

/**
 * 处理授权码授权（完整实现）
 * 支持 PKCE (RFC 7636)
 */
async function handleAuthorizationCodeGrant(
  code: string,
  client_id: string,
  client_secret: string,
  redirect_uri?: string,
  code_verifier?: string
): Promise<NextResponse> {
  console.log('🔑 [OAuth] 处理授权码换取 token:', {
    code: code?.substring(0, 20) + '...',
    client_id,
    has_client_secret: !!client_secret,
    redirect_uri,
    has_code_verifier: !!code_verifier
  });

  if (!code) {
    console.error('❌ [OAuth] 缺少授权码');
    return NextResponse.json({
      error: 'invalid_request',
      error_description: 'Missing authorization code'
    }, { status: 400 });
  }

  if (!client_id) {
    console.error('❌ [OAuth] 缺少 client_id');
    return NextResponse.json({
      error: 'invalid_request',
      error_description: 'Missing client_id'
    }, { status: 400 });
  }

  try {
    // 从 Redis 获取授权码信息
    const redis = (await import('@/lib/redis')).default;
    const authCodeDataStr = await redis.get(`oauth:auth_code:${code}`);

    console.log('🔍 [OAuth] 授权码查询结果:', {
      found: !!authCodeDataStr,
      code: code?.substring(0, 20) + '...'
    });

    if (!authCodeDataStr) {
      console.error('❌ [OAuth] 授权码不存在或已过期');
      return NextResponse.json({
        error: 'invalid_grant',
        error_description: 'Authorization code expired or invalid'
      }, { status: 400 });
    }

    const authCodeData = JSON.parse(authCodeDataStr);

    console.log('📋 [OAuth] 授权码数据:', {
      client_id: authCodeData.client_id,
      user_id: authCodeData.user_id,
      scope: authCodeData.scope,
      redirect_uri: authCodeData.redirect_uri,
      has_code_challenge: !!authCodeData.code_challenge
    });

    // 验证 client_id
    if (authCodeData.client_id !== client_id) {
      console.error('❌ [OAuth] client_id 不匹配:', {
        expected: authCodeData.client_id,
        received: client_id
      });
      return NextResponse.json({
        error: 'invalid_grant',
        error_description: 'Authorization code was issued to another client'
      }, { status: 400 });
    }

    // 验证 redirect_uri（如果提供）
    if (redirect_uri && authCodeData.redirect_uri !== redirect_uri) {
      console.error('❌ [OAuth] redirect_uri 不匹配:', {
        expected: authCodeData.redirect_uri,
        received: redirect_uri
      });
      return NextResponse.json({
        error: 'invalid_grant',
        error_description: 'Redirect URI mismatch'
      }, { status: 400 });
    }

    // 验证 PKCE code_verifier
    if (authCodeData.code_challenge) {
      if (!code_verifier) {
        console.error('❌ [OAuth] 缺少 code_verifier (PKCE)');
        return NextResponse.json({
          error: 'invalid_request',
          error_description: 'Code verifier required for PKCE'
        }, { status: 400 });
      }

      // 计算 code_challenge
      const crypto = await import('crypto');
      let computedChallenge: string;

      if (authCodeData.code_challenge_method === 'S256') {
        computedChallenge = crypto
          .createHash('sha256')
          .update(code_verifier)
          .digest('base64url');
      } else {
        // plain method
        computedChallenge = code_verifier;
      }

      console.log('🔐 [OAuth] PKCE 验证:', {
        method: authCodeData.code_challenge_method,
        computed: computedChallenge?.substring(0, 20) + '...',
        expected: authCodeData.code_challenge?.substring(0, 20) + '...',
        match: computedChallenge === authCodeData.code_challenge
      });

      if (computedChallenge !== authCodeData.code_challenge) {
        console.error('❌ [OAuth] code_verifier 验证失败');
        return NextResponse.json({
          error: 'invalid_grant',
          error_description: 'Invalid code verifier'
        }, { status: 400 });
      }
    }

    // 授权码只能使用一次，立即删除
    await redis.del(`oauth:auth_code:${code}`);
    console.log('🗑️ [OAuth] 授权码已删除（一次性使用）');

    // 从授权码数据中获取duration，默认7天
    const duration = authCodeData.duration || 7;

    // 生成新的 access_token
    const crypto = await import('crypto');
    const access_token = `MCP_TOKEN_${crypto.randomBytes(32).toString('hex')}`;

    // 计算过期时间（秒）
    // 永久(0)时，Redis设置10年过期，但在token数据中标记为永久
    const redisExpiry = duration === 0 ? 10 * 365 * 24 * 60 * 60 : duration * 24 * 60 * 60;
    const expiresIn = duration === 0 ? undefined : duration * 24 * 60 * 60;

    console.log('🎫 [OAuth] 生成 access_token:', {
      token: access_token.substring(0, 30) + '...',
      duration,
      redis_expiry_days: Math.floor(redisExpiry / (24 * 60 * 60)),
      is_permanent: duration === 0
    });

    // 存储 access_token 到 Redis
    const tokenData = {
      userId: authCodeData.user_id.toString(), // 转为字符串以保持一致性
      scope: authCodeData.scope,
      client_id: authCodeData.client_id,
      app_name: authCodeData.app_name || null, // 自定义应用名称
      created_at: Date.now(),
      is_permanent: duration === 0, // 标记是否永久
      duration: duration
    };

    await redis.setex(
      `token:${access_token}`,
      redisExpiry,
      JSON.stringify(tokenData)
    );

    console.log('✅ [OAuth] Token 存储成功');


    // 返回 OAuth 2.0 标准响应
    const response: OAuthTokens = {
      access_token,
      token_type: 'Bearer',
      expires_in: expiresIn, // 永久时返回undefined
      scope: authCodeData.scope
    };

    console.log('🎉 [OAuth] Token 交换成功:', {
      access_token: access_token.substring(0, 30) + '...',
      token_type: response.token_type,
      expires_in: response.expires_in,
      scope: response.scope
    });

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
      }
    });
  } catch (error) {
    console.error('❌ [OAuth] 授权码换取失败:', error);
    return NextResponse.json({
      error: 'server_error',
      error_description: 'Failed to exchange authorization code'
    }, { status: 500 });
  }
}

/**
 * 处理刷新令牌
 */
async function handleRefreshTokenGrant(_refreshToken: string, _scope?: string): Promise<NextResponse> {
  // 验证刷新令牌
  // 这里可以实现完整的刷新令牌逻辑
  return NextResponse.json({
    error: 'unsupported_grant_type',
    error_description: 'Refresh token flow not implemented in this version.'
  }, { status: 400 });
}

/**
 * OAuth 2.0 令牌验证端点
 * 用于验证令牌的有效性
 */
export async function handleOAuthIntrospection(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ active: false }, { status: 400 });
    }

    // 验证普通 Token
    const user = await validateToken(token);
    if (user) {
      // 从Redis获取token数据以检查是否永久
      const redis = (await import('@/lib/redis')).default;
      const tokenDataStr = await redis.get(`token:${token}`);
      let exp: number | undefined;

      if (tokenDataStr) {
        const tokenData = JSON.parse(tokenDataStr);
        if (!tokenData.is_permanent && tokenData.duration) {
          // 计算过期时间戳
          const createdTime = tokenData.created_at || Date.now();
          exp = Math.floor((createdTime + tokenData.duration * 24 * 60 * 60 * 1000) / 1000);
        }
      }

      return NextResponse.json({
        active: true,
        username: user.account,
        scope: 'read write',
        client_id: `mcp-client-${user.id}`,
        token_type: 'Bearer',
        exp: exp // 永久token返回undefined，否则返回过期时间戳
      });
    }

    // 验证长期 Token
    const userId = await validateLongTermToken(token);
    if (userId) {
      return NextResponse.json({
        active: true,
        username: `user-${userId}`,
        scope: 'read write',
        client_id: `mcp-client-${userId}`,
        token_type: 'Bearer',
        exp: undefined
      });
    }

    return NextResponse.json({ active: false });

  } catch {
    return NextResponse.json({ active: false }, { status: 400 });
  }
}

/**
 * OAuth 2.0 令牌撤销端点
 * 调用真正的撤销逻辑
 */
export async function handleOAuthRevocation(request: NextRequest): Promise<NextResponse> {
  // 导入 revoke 路由的处理逻辑
  // 注意：这里直接调用 revokeToken 函数，避免重复代码
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

    const { token } = body;

    if (!token) {
      return NextResponse.json({
        error: 'invalid_request',
        error_description: 'token parameter is required'
      }, { status: 400 });
    }

    // 执行撤销逻辑
    const RedisService = (await import('@/lib/redis')).default;
    (await import('@/services/token'));
    const { getPrisma } = await import('@/lib/prisma');

    // 1. 尝试删除普通登录 Token
    const userTokenKey = `user:${token}`;
    const userTokenDeleted = await RedisService.del(userTokenKey);
    if (userTokenDeleted > 0) {
      // Token deleted
    }

    // 2. 尝试删除 OAuth Token
    const oauthTokenKey = `token:${token}`;
    const oauthTokenDeleted = await RedisService.del(oauthTokenKey);
    if (oauthTokenDeleted > 0) {
      // Token deleted
    }

    // 3. 如果是长期 Token，从数据库删除
    if (token.startsWith('LTK_')) {
      try {
        const prisma = await getPrisma();
        const result = await prisma.longTermToken.deleteMany({
          where: { token }
        });
        if (result.count > 0) {
          void result;
        }
      } catch (error) {
        console.error('删除长期 Token 失败:', error);
      }
    }

    // RFC 7009: 即使 token 不存在，也要返回成功
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('OAuth revocation failed:', error);
    return NextResponse.json({
      error: 'invalid_request',
      error_description: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 });
  }
}

/**
 * 标准 OAuth 2.0 错误响应生成器
 */
export function createOAuthErrorResponse(
  error: string,
  error_description?: string,
  error_uri?: string
): NextResponse {
  const response: OAuthErrorResponse = { error };
  if (error_description) response.error_description = error_description;
  if (error_uri) response.error_uri = error_uri;

  return NextResponse.json(response, { status: 400 });
}

/**
 * 增强的认证中间件，支持标准 OAuth 2.0 Bearer Token
 * 支持的 Token 类型：1. 普通 Bearer Token, 2. 长期 Token (LTK_ 前缀)
 */
export async function authenticateMcpRequestEnhanced(headers: Headers): Promise<import('@/types').User> {
  const token = getTokenFromRequest(headers);

  if (!token) {
    throw new Error("Missing authentication credentials. Please provide 'Authorization: Bearer <token>' header");
  }

  // 1. 验证普通 Bearer Token
  const user = await validateToken(token);
  if (user) {
    return user;
  }

  // 2. 验证长期 Token (LTK_ 前缀)
  if (token.startsWith('LTK_')) {
    const userId = await validateLongTermToken(token);
    if (userId) {
      // 从数据库获取用户信息
      const { getUserById } = await import('@/services/user');
      const userInfo = await getUserById(parseInt(userId));
      if (userInfo) {
        return userInfo as import('@/types').User;
      }
    }
    throw new Error("Invalid or expired long-term token");
  }

  throw new Error("Invalid or expired token");
}