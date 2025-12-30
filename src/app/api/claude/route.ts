import { NextRequest, NextResponse } from 'next/server';
import { generDescriptionStream } from '@/services/claude';

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
 * 仅支持流式响应
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json(
        { status: false, message: '缺少 content 参数' },
        { status: 400 }
      );
    }

    // 流式响应
    const streamResponse = await generDescriptionStream(content);
    return createStreamResponse(streamResponse);
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
