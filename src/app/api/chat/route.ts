/**
 * 聊天 API 路由
 * POST /api/chat
 * 使用 ReAct Agent 和 SSE 流式响应
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl, getUserFromToken } from '@/lib/auth';
import { toolRegistry } from '@/services/ai/tools';
import { searchArticlesTool } from '@/services/ai/tools/search-articles';
import dayjs from 'dayjs';
import { getAllTags } from '@/services/tag';
import { createOpenAIModel } from '@/lib/ai';
import { createReactAgent } from '@/lib/react-agent';
import { createSSEStream, createSSEResponse } from '@/lib/sse';

// 注册工具
toolRegistry.register(searchArticlesTool);

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
 * 使用 ReAct Agent 和 SSE 流式响应
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ChatRequest;
    const { message, history = [] } = body;

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

    // 构建通用信息
    const userInfo = user
      ? `用户已登录，昵称：${user.nickname || user.account}${user.role ? `（${user.role}）` : ''}`
      : '用户未登录（游客模式）';

    // 获取工具描述
    const toolsDescription = toolRegistry.getToolsDescription();

    const articleTags = await getAllTags();
    const tags = articleTags.map(tag => `${tag[0]}（${tag[1]}篇）`).join(',');
    console.log(tags);

    // 构建系统指令（ReAct 风格）
    const systemInstruction = `你是一个智能助手，使用 ReAct (Reasoning and Acting) 范式来回答问题。

**当前上下文信息：**
- 网站名称：${siteName}
- 当前时间：${currentTime}
- 用户状态：${userInfo}
- 网站地址：${baseUrl}

**知识库相关的文章标签和文章数量：**
${tags}

**工具使用说明：**
${toolsDescription}

**ReAct 工作流程：**
1. **思考 (Thought)**：分析用户问题，思考需要做什么
2. **行动 (Action)**：如果需要查询知识库，使用工具调用格式
3. **观察 (Observation)**：查看工具返回的结果
4. **重复**：根据需要重复思考-行动-观察循环
5. **回答 (Answer)**：当有足够信息时，给出最终答案

**回答要求：**
1. **智能使用工具**：当需要查询博客文章、技术文档或作者信息时，使用 search_articles 工具，根据标签内的文章数量，调整 search_articles 工具 limit 参数大小
2. **结合通用知识**：如果工具返回的结果不足，可以结合通用知识补充
3. **引用格式**：引用文章时使用 Markdown 链接格式 [文章标题](文章URL)，
4. **语言要求**：使用中文回答
5. **最终答案**：当完成所有必要的工具调用后，给出清晰、有帮助的最终答案

**注意事项：**
- 不要在同一轮中多次调用工具，一次调用一个工具
- 工具调用完成后会收到结果，基于结果继续推理
- 如果问题可以直接回答，不需要调用工具`;

    // 创建模型
    const model = createOpenAIModel({
      temperature: 0.7,
      maxTokens: 2000,
    });

    // 创建 ReAct Agent
    const agent = createReactAgent({
      model,
      systemPrompt: systemInstruction,
      maxIterations: 5,
      verbose: true,
    });

    // 创建 SSE 流
    const stream = createSSEStream(async (send) => {
      // 运行 ReAct Agent
      await agent.run({
        input: message,
        history,
        onEvent: send,
      });
    });

    // 返回 SSE 响应
    return createSSEResponse(stream);

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
    message: '聊天 API 正常运行',
  });
}
