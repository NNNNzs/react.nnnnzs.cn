/**
 * API 路由: /api/wechat/getImg
 * 功能: 代理开放平台的二维码图片
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOpenPlatformConfig, generateSignature } from '@/lib/open-platform';

/**
 * GET /api/wechat/getImg?token=xxx&env=release
 * 获取二维码图片
 *
 * 代理开放平台的二维码图片，需要添加签名
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const env = (searchParams.get('env') || 'release') as 'release' | 'trial' | 'develop';

    console.log('[getImg] 请求参数:', { token, env });

    if (!token) {
      return NextResponse.json(
        { status: false, msg: '缺少 token 参数' },
        { status: 400 }
      );
    }

    // 获取配置并生成签名
    const { appKey, appSecret, apiUrl } = await getOpenPlatformConfig();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path = '/open-platform/qr/getImg';
    const signature = generateSignature('GET', path, timestamp, null, appSecret);

    console.log('[getImg] 请求配置:', { appKey, apiUrl, path, timestamp });

    // 构建带签名的 URL
    const url = `${apiUrl}${path}?token=${token}&env_version=${env}`;
    console.log('[getImg] 请求 URL:', url);

    const response = await fetch(url, {
      headers: {
        'X-App-Key': appKey,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
      },
    });

    console.log('[getImg] 响应状态:', response.status, response.statusText);

    if (!response.ok) {
      console.error('获取二维码失败:', response.status, response.statusText);
      return NextResponse.json(
        { status: false, msg: '获取二维码失败' },
        { status: response.status }
      );
    }

    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(new Uint8Array(imageBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('获取二维码失败:', error);
    return NextResponse.json(
      { status: false, msg: '获取二维码失败' },
      { status: 500 }
    );
  }
}
