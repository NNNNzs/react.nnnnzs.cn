import { NextRequest, NextResponse } from 'next/server';
import { generDescriptionStream } from '@/services/ai';
import { createStreamResponse } from '@/lib/stream';

/**
 * AI 生成描述 API 路由
 * POST /api/ai/generate/description
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
