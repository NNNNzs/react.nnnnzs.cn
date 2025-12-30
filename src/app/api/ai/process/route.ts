/**
 * AI文本处理API路由
 * POST /api/ai/process
 * 仅支持流式响应
 */

import { NextRequest, NextResponse } from 'next/server';
import { processAITextStream } from '@/services/ai';
import { validateTextForAI, type AIActionType } from '@/lib/ai-text';
import { createStreamResponse } from '@/lib/stream';

/**
 * 请求体类型定义
 */
interface AIProcessRequest {
  text: string;
  action: AIActionType;
  context?: string;
}

/**
 * AI文本处理API
 * POST /api/ai/process
 * 仅支持流式响应
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AIProcessRequest;
    const { text, action, context } = body;

    // 参数验证
    if (!text) {
      return NextResponse.json(
        { status: false, message: '缺少 text 参数' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { status: false, message: '缺少 action 参数' },
        { status: 400 }
      );
    }

    // 验证操作类型
    const validActions = ['refine', 'expand', 'summarize'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { status: false, message: `action 必须是 ${validActions.join(', ')} 之一` },
        { status: 400 }
      );
    }

    // 验证文本
    const validation = validateTextForAI(text);
    if (!validation.valid) {
      return NextResponse.json(
        { status: false, message: validation.reason },
        { status: 400 }
      );
    }

    // 流式处理
    try {
      const streamResponse = await processAITextStream({ text, action, context });
      return createStreamResponse(streamResponse, { allowCORS: true });
    } catch (error) {
      console.error('流式处理错误:', error);
      return NextResponse.json(
        {
          status: false,
          message: error instanceof Error ? error.message : '流式处理失败',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('AI API 错误:', error);
    return NextResponse.json(
      {
        status: false,
        message: error instanceof Error ? error.message : '服务器内部错误',
      },
      { status: 500 }
    );
  }
}

/**
 * GET Handler - 健康检查
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/ai/process',
    method: 'POST',
    supportedActions: ['refine', 'expand', 'summarize'],
    streamSupport: true,
    maxTextLength: 5000,
    note: '仅支持流式响应'
  });
}

/**
 * CORS 预检请求
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
