/**
 * GitHub OAuth 回调路由
 * 路由: /api/github/callback
 * 处理 GitHub OAuth 授权回调
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import {
  generateToken,
  storeToken,
  TOKEN_KEY,
  validateToken,
  getTokenFromRequest,
} from '@/lib/auth';
import bcrypt from 'bcryptjs';

/**
 * 获取 GitHub 用户信息
 */
async function getGithubUser(accessToken: string) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error('获取 GitHub 用户信息失败');
  }
  
  return response.json();
}

/**
 * 交换 GitHub Access Token
 */
async function exchangeCodeForToken(code: string) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth 配置缺失');
  }
  
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });
  
  if (!response.ok) {
    throw new Error('交换 GitHub Access Token 失败');
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }
  
  return data.access_token;
}

/**
 * GET /api/github/callback
 * 处理 GitHub OAuth 回调
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    // 检查是否有错误
    if (error) {
      const errorUrl = new URL('/login', request.url);
      errorUrl.searchParams.set('error', 'github_auth_failed');
      return NextResponse.redirect(errorUrl);
    }
    
    // 检查必要参数
    if (!code || !state) {
      const errorUrl = new URL('/login', request.url);
      errorUrl.searchParams.set('error', 'invalid_params');
      return NextResponse.redirect(errorUrl);
    }
    
    // 解析 state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { action, redirect } = stateData;
    
    // 交换 Access Token
    const accessToken = await exchangeCodeForToken(code);
    
    // 获取 GitHub 用户信息
    const githubUser = await getGithubUser(accessToken);
    
    const prisma = await getPrisma();
    
    // 根据 action 处理不同的逻辑
    if (action === 'login') {
      // GitHub 登录逻辑
      // 查找是否已经存在该 GitHub 账号关联的用户
      let user = await prisma.tbUser.findFirst({
        where: { github_id: String(githubUser.id) },
      });
      
      if (!user) {
        // 创建新用户
        const randomPassword = bcrypt.hashSync(
          Math.random().toString(36).slice(-8),
          10
        );

        // 从请求头中解析用户 IP（兼容代理转发）
        const xForwardedFor = request.headers.get('x-forwarded-for');
        const realIp = request.headers.get('x-real-ip');
        const ip =
          (xForwardedFor && xForwardedFor.split(',')[0]?.trim()) ||
          realIp ||
          'unknown';
        
        user = await prisma.tbUser.create({
          data: {
            account: `gh_${githubUser.login}`,
            nickname: githubUser.name || githubUser.login,
            avatar: githubUser.avatar_url,
            password: randomPassword,
            github_id: String(githubUser.id),
            github_username: githubUser.login,
            github_access_token: accessToken,
            registered_ip: ip,
            registered_time: new Date(),
            status: 1,
          },
        });
      } else {
        // 更新 GitHub 信息和 Access Token
        user = await prisma.tbUser.update({
          where: { id: user.id },
          data: {
            github_username: githubUser.login,
            github_access_token: accessToken,
            avatar: githubUser.avatar_url,
          },
        });
      }
      
      // 生成 Token
      const token = generateToken();
      
      // 将 token 和用户信息存储到 Redis
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...userWithoutPassword } = user;
      await storeToken(token, userWithoutPassword as typeof user);
      
      // 重定向到目标页面，并设置 token
      const redirectUrl = new URL(redirect, request.url);
      const response = NextResponse.redirect(redirectUrl);
      
      // 设置 cookie
      response.cookies.set(TOKEN_KEY, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60, // 30 天
        path: '/',
        sameSite: 'lax',
      });
      
      return response;
    } else if (action === 'bind') {
      // GitHub 账号绑定逻辑
      // 需要用户已经登录
      const token = getTokenFromRequest(request.headers);
      
      if (!token) {
        const errorUrl = new URL('/login', request.url);
        errorUrl.searchParams.set('error', 'not_logged_in');
        return NextResponse.redirect(errorUrl);
      }
      
      // 验证 token 获取用户信息
      const currentUser = await validateToken(token);
      
      if (!currentUser) {
        const errorUrl = new URL('/login', request.url);
        errorUrl.searchParams.set('error', 'invalid_token');
        return NextResponse.redirect(errorUrl);
      }
      
      // 检查该 GitHub 账号是否已经绑定到其他用户
      const existingUser = await prisma.tbUser.findFirst({
        where: {
          github_id: String(githubUser.id),
          id: { not: currentUser.id },
        },
      });
      
      if (existingUser) {
        const errorUrl = new URL(redirect, request.url);
        errorUrl.searchParams.set('error', 'github_already_bound');
        return NextResponse.redirect(errorUrl);
      }
      
      // 绑定 GitHub 账号
      const updatedUser = await prisma.tbUser.update({
        where: { id: currentUser.id },
        data: {
          github_id: String(githubUser.id),
          github_username: githubUser.login,
          github_access_token: accessToken,
        },
      });

      // 更新当前 token 对应的 Redis 中的用户信息
      if (token) {
        await storeToken(token, updatedUser as never);
      }
      
      // 重定向回目标页面
      const redirectUrl = new URL(redirect, request.url);
      redirectUrl.searchParams.set('success', 'github_bound');
      return NextResponse.redirect(redirectUrl);
    }
    
    // 未知的 action
    const errorUrl = new URL('/login', request.url);
    errorUrl.searchParams.set('error', 'unknown_action');
    return NextResponse.redirect(errorUrl);
  } catch (error) {
    console.error('GitHub 回调处理失败:', error);
    const errorUrl = new URL('/login', request.url);
    errorUrl.searchParams.set('error', 'callback_failed');
    return NextResponse.redirect(errorUrl);
  }
}
