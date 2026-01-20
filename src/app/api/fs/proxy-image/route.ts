/**
 * 图片代理 API
 * GET /api/fs/proxy-image?url=<image_url>
 * 用于从外链 URL 获取图片，避免 CORS 问题
 */

import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/dto/response.dto';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json(errorResponse('缺少 URL 参数'), { status: 400 });
    }

    // 验证 URL 格式
    let url: URL;
    try {
      url = new URL(imageUrl);
    } catch {
      return NextResponse.json(errorResponse('无效的 URL'), { status: 400 });
    }

    // 只允许 http 和 https 协议
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return NextResponse.json(errorResponse('只支持 HTTP/HTTPS 协议'), { status: 400 });
    }

    // 获取图片
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      // 10 秒超时
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        errorResponse(`无法获取图片: ${response.status}`),
        { status: response.status }
      );
    }

    // 验证内容类型
    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      return NextResponse.json(errorResponse('URL 指向的不是图片文件'), { status: 400 });
    }

    // 获取图片数据
    const imageBuffer = await response.arrayBuffer();

    // 返回图片数据
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // 缓存 1 小时
      },
    });
  } catch (error) {
    console.error('图片代理失败:', error);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json(errorResponse('请求超时'), { status: 408 });
      }
    }

    return NextResponse.json(
      errorResponse(error instanceof Error ? error.message : '图片代理失败'),
      { status: 500 }
    );
  }
}
