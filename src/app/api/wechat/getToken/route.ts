/**
 * API 路由: /api/wechat/getToken
 * 功能: 生成用于微信扫码登录的 token
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import redisService from '@/lib/redis';
import { successResponse, errorResponse } from '@/lib/auth';

/**
 * 生成短 token（32位，符合微信小程序场景值限制）
 */
function createToken(): string {
  let id =  uuidv4().replace(/-/g, '').toUpperCase();
  // 把前几位换成 blog_
  id = id.replace(/^[a-zA-Z0-9]{8}/, 'blog_');
  return id;
}

/**
 * 创建基础信息
 */
interface BaseInfo {
  token: string;
  status: number; // -1: 未扫码, 0: 已扫码未授权, 1: 已授权
  appName: string;
  createTime: string;
}

function createBaseInfo(token: string): BaseInfo {
  return {
    token,
    status: -1,
    appName: '博客登录',
    createTime: new Date().toLocaleString('zh-CN'),
  };
}

/**
 * GET /api/wechat/getToken
 * 获取用于扫码登录的 token
 */
export async function GET() {
  try {
    const token = createToken();
    const baseInfo = createBaseInfo(token);

    // 存储到 Redis，设置 1 小时过期
    await redisService.set(
      `wechat_screen_key/${token}`,
      JSON.stringify(baseInfo),
      'EX',
      3600
    );

    return NextResponse.json(successResponse(token));
  } catch (error) {
    console.error('生成 token 失败:', error);
    return NextResponse.json(
      errorResponse('生成 token 失败'),
      { status: 500 }
    );
  }
}
