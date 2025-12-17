import { NextRequest, NextResponse } from 'next/server';
import { generDescription, generDescriptionStream } from '@/services/claude';
import { successResponse } from '@/dto/response.dto';

/**
 * 创建流式响应
 * @param stream ReadableStream 对象
 * @returns Response 对象
 */
const createStreamResponse = (stream: ReadableStream): Response => {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
};

/**
 * Claude API 路由
 * POST /api/claude
 * 
 * 支持流式和非流式响应
 * - 如果请求中包含 `stream: true`，返回流式响应
 * - 否则返回 JSON 响应
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, stream } = body;

    if (!content) {
      return NextResponse.json(
        { status: false, message: '缺少 content 参数' },
        { status: 400 }
      );
    }

    // 如果请求流式响应
    if (stream) {
      const streamResponse = await generDescriptionStream(content);
      return createStreamResponse(streamResponse);
    }

    // 非流式响应
    const response = await generDescription(content);
    return NextResponse.json(successResponse(response));
  } catch (error) {
    console.error('Claude API 错误:', error);
    return NextResponse.json(
      {
        status: false,
        message: error instanceof Error ? error.message : '生成描述失败',
      },
      { status: 500 }
    );
  }
}
