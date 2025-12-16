/**
 * GitHub OAuth 授权路由
 * 路由: /api/github/auth
 * 重定向到 GitHub 授权页面
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/github/auth
 * 发起 GitHub OAuth 授权
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'login'; // login 或 bind
    const redirect = searchParams.get('redirect') || '/';
    
    // 从环境变量获取 GitHub OAuth 配置
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { status: false, message: 'GitHub OAuth 配置缺失' },
        { status: 500 }
      );
    }
    
    // 构建 GitHub 授权 URL
    const state = Buffer.from(
      JSON.stringify({ action, redirect })
    ).toString('base64');
    
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', clientId);
    githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
    githubAuthUrl.searchParams.set('scope', 'user,public_repo');
    githubAuthUrl.searchParams.set('state', state);
    console.log('githubAuthUrl', githubAuthUrl.toString());
    
    return NextResponse.redirect(githubAuthUrl.toString());
  } catch (error) {
    console.error('GitHub 授权失败:', error);
    return NextResponse.json(
      { status: false, message: 'GitHub 授权失败' },
      { status: 500 }
    );
  }
}
