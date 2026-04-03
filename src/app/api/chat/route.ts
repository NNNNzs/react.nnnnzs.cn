/**
 * 聊天 API 路由
 * POST /api/chat
 * 使用 ReAct Agent 驱动的 RAG 架构和 SSE 流式响应
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl, getUserFromToken } from '@/lib/auth';
import dayjs from 'dayjs';
import { chatRAGAgentStream } from '@/services/ai/rag';
import { createStreamResponse } from '@/lib/stream';

/**
 * 请求体类型定义
 */
interface ChatRequest {
  message: string;
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * 聊天 API
 * POST /api/chat
 * 使用简单 RAG 和 SSE 流式响应
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history } = body as ChatRequest;

    // 参数验证
    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { status: false, message: '消息内容不能为空' },
        { status: 400 }
      );
    }

    // 获取通用信息
    const baseUrl = getBaseUrl(request);
    const user = await getUserFromToken(request);
    const currentTime = dayjs().format('YYYY年MM月DD日 HH:mm:ss');
    const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'NNNNzs';

    // 构建用户信息
    const userInfo = user
      ? `用户已登录，昵称：${user.nickname || user.account}${user.role ? `（${user.role}）` : ''}`
      : '用户未登录（游客模式）';

    // 调用 RAG Agent 服务（流式响应，ReAct 范式）
    const stream = await chatRAGAgentStream({
      question: message,
      userInfo,
      siteName,
      currentTime,
      baseUrl,
      history: history || [],
    });

    // 返回流式响应（使用 createStreamResponse 确保正确的分块传输）
    console.log('📤 准备返回流式响应');
    return createStreamResponse(stream);
  } catch (error) {
    console.error('聊天 API 错误:', error);
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
    status: true,
    message: '聊天 API 正常运行（ReAct Agent 驱动的 RAG 模式）',
  });
}
