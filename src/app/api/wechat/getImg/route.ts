/**
 * API 路由: /api/wechat/getImg
 * 功能: 根据 token 生成微信小程序码图片
 */

import { NextRequest, NextResponse } from 'next/server';
import { wechat } from '@/lib/wechat';
import redisService from '@/lib/redis';

/**
 * GET /api/wechat/getImg?token=xxx&env=release
 * 获取小程序码图片
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const env = (searchParams.get('env') || 'trial') as 'release' | 'trial' | 'develop';

    if (!token) {
      return NextResponse.json(
        { status: false, msg: '缺少 token 参数' },
        { status: 400 }
      );
    }

    // 检查 token 是否有效
    const infoStr = await redisService.get(`wechat_screen_key/${token}`);
    if (!infoStr) {
      return NextResponse.json(
        { status: false, msg: 'token 不存在或已过期' },
        { status: 404 }
      );
    }

    // 生成小程序码
    const qrcodeBuffer = await wechat.getUnlimitedQRCode(
      token,
      'pages/index/index',
      env
    );

    // 更新 Redis 中的信息
    const info = JSON.parse(infoStr);
    const ua = request.headers.get('user-agent') || '';
    info.ua = ua;
    info.createTime = new Date().toLocaleString('zh-CN');
    await redisService.set(
      `wechat_screen_key/${token}`,
      JSON.stringify(info),
      'EX',
      3600
    );

    // 返回图片
    return new NextResponse(new Uint8Array(qrcodeBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('生成小程序码失败:', error);
    return NextResponse.json(
      { status: false, msg: '生成小程序码失败' },
      { status: 500 }
    );
  }
}
