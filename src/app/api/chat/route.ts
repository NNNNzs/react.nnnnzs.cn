/**
 * 聊天 API 路由
 * POST /api/chat
 * 支持工具调用（ReAct 模式）和流式响应
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl, getUserFromToken } from '@/lib/auth';
import {
  getAnthropicMessageWithSystem,
  streamAnthropicMessagesWithSystem,
  type AnthropicModelConfig,
} from '@/services/ai/anthropic';
import { StreamTagGenerator } from '@/lib/stream-tags';
import {
  toolRegistry,
  parseToolCalls,
  executeToolCall,
  formatToolResult,
} from '@/services/ai/tools';
import { searchArticlesTool } from '@/services/ai/tools/search-articles';
import dayjs from 'dayjs';

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
 * 格式化工具搜索结果，生成包含文章链接的上下文
 */
function formatSearchResults(
  searchData: {
    query: string;
    results: Array<{
      postId: number;
      title: string;
      url: string | null;
      chunks: Array<{
        chunkIndex: number;
        chunkText: string;
        score: number;
      }>;
    }>;
  },
  baseUrl: string
): string {
  if (!searchData.results || searchData.results.length === 0) {
    return '未找到相关文章。';
  }

  const contextChunks = searchData.results.flatMap((result, resultIndex) => {
    // 构建文章链接（如果有 URL，使用完整 URL；否则只显示标题）
    let postUrl: string | null = null;
    if (result.url) {
      // 如果 URL 已经是完整 URL（以 http:// 或 https:// 开头），直接使用
      if (result.url.startsWith('http://') || result.url.startsWith('https://')) {
        postUrl = result.url;
          } else {
        // 否则拼接 baseUrl
        postUrl = `${baseUrl}${result.url}`;
      }
    }
    const titleWithLink = postUrl
      ? `[${result.title}](${postUrl})`
      : result.title;

    return result.chunks.map((chunk, chunkIndex) => {
      return `[片段 ${resultIndex + 1}-${chunkIndex + 1}] 来自文章《${titleWithLink}》（相似度: ${(chunk.score * 100).toFixed(1)}%）\n${chunk.chunkText}`;
    });
  });

  return `以下是从知识库中检索到的相关内容（查询: "${searchData.query}"）：\n\n${contextChunks.join('\n\n')}\n\n请基于以上内容回答用户的问题。如果相关内容不足以回答问题，可以结合你的通用知识进行补充。`;
}

/**
 * 聊天 API
 * POST /api/chat
 * 支持工具调用（ReAct 模式）
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

    // 构建系统指令（包含工具说明）
    const systemInstruction = `你是一个智能助手，擅长基于知识库内容回答用户问题。

**当前上下文信息：**
- 网站名称：${siteName}
- 当前时间：${currentTime}
- 用户状态：${userInfo}
- 网站地址：${baseUrl}

**工具使用说明：**
${toolsDescription}

**回答要求：**
1. **智能使用工具**：当用户询问关于博客文章、技术文档或知识库内容的问题时，使用 search_articles 工具检索相关信息
2. **结合通用知识**：如果工具返回的结果不足以回答问题，可以结合你的通用知识进行补充
3. **回答质量**：回答要准确、清晰、有帮助，逻辑清晰
4. **引用格式**：**重要：当引用知识库中的文章时，必须使用 Markdown 链接格式 [文章标题](文章URL) 来引用**
   - 例如：更多信息请参考[这篇文章](https://example.com/2024/12/25/article-title)
   - 链接会在新标签页打开，用户可以直接点击访问
5. **来源说明**：如果引用了知识库内容，应该说明来源并附上链接
6. **语言要求**：使用中文回答
7. **重要：不要使用 <think> 标签**：工具调用过程已经通过系统展示，你只需要直接回答问题即可

**回答格式建议：**
1. 直接给出主要答案（不要使用 think 标签）
2. 如果有相关文章，提供链接引用
3. 如果需要，可以给出补充说明或建议`;

    // 构建消息数组
    const messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }> = [];

    // 添加历史对话（最近6轮）
    if (history.length > 0) {
      const recentHistory = history.slice(-6);
      for (const h of recentHistory) {
        messages.push({
          role: h.role,
          content: h.content,
        });
      }
    }

    // 添加当前用户消息
    messages.push({
      role: 'user',
      content: message,
    });

    // 创建 Anthropic 模型配置
    const aiModelConfig: AnthropicModelConfig = {
      temperature: 0.7,
      maxTokens: 2000,
    };

    // 创建流式响应（提前创建，以便在 ReAct 循环中实时发送）
    const tagGenerator = new StreamTagGenerator();

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // ReAct 循环：最多执行 3 轮工具调用
          const maxToolRounds = 3;
          let toolCallCount = 0;
          let hasFinalResponse = false;

          for (let round = 0; round < maxToolRounds; round++) {
            console.log(`🔄 ReAct 循环第 ${round + 1} 轮...`);

            // 调用 AI（非流式，用于检测工具调用）
            const aiResponse = await getAnthropicMessageWithSystem(
              systemInstruction,
              messages,
              aiModelConfig
            );

            console.log(`✅ AI 响应完成，长度: ${aiResponse.length}`);

            // 检查是否有工具调用
            const toolCalls = parseToolCalls(aiResponse);

            if (toolCalls.length === 0) {
              // 没有工具调用，这是最终响应
              // 使用真正的流式调用生成最终响应
              console.log('✅ 没有工具调用，使用流式响应');
              
              // 发送 content 标签开始
              controller.enqueue(tagGenerator.startContent());

              // 使用流式调用并实时转发给前端
              const streamResponse = await streamAnthropicMessagesWithSystem(
                systemInstruction,
                messages,
                aiModelConfig
              );

              // 读取流式响应并实时转发
              const reader = streamResponse.getReader();
              const decoder = new TextDecoder();
              
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  
                  // 解码并发送内容块
                  const text = decoder.decode(value, { stream: true });
                  if (text) {
                    controller.enqueue(tagGenerator.generateContent(text));
                  }
                }
              } finally {
                reader.releaseLock();
              }

              // 发送 content 标签结束
              controller.enqueue(tagGenerator.endContent());
              hasFinalResponse = true;
              break;
            }

            // 有工具调用，执行工具
            console.log(`🔧 检测到 ${toolCalls.length} 个工具调用`);
            toolCallCount += toolCalls.length;

            // 移除工具调用标签，保留其他内容作为思考过程
            let responseWithoutTools = aiResponse;
            for (const toolCall of toolCalls) {
              responseWithoutTools = responseWithoutTools.replace(toolCall.fullMatch, '');
              
              // 实时发送工具调用开始（think 标签）
              const thinkContentStart = `🔧 ${toolCall.name}: 正在调用工具...`;
              controller.enqueue(tagGenerator.generateThink(thinkContentStart));
            }

            // 执行所有工具调用
            const toolResults: string[] = [];
            for (const toolCall of toolCalls) {
              const result = await executeToolCall(toolCall);

              // 实时发送工具调用结果（think 标签）
              let thinkContentResult: string;
              if (result.success) {
                // 对于 search_articles，显示找到的文章数量
                if (toolCall.name === 'search_articles' && result.data) {
                  const searchData = result.data as {
                    results: Array<{ title: string }>;
                    totalResults: number;
                  };
                  thinkContentResult = `✅ ${toolCall.name}: 找到 ${searchData.totalResults || 0} 篇相关文章`;
                } else {
                  thinkContentResult = `✅ ${toolCall.name}: 执行成功`;
                }
              } else {
                thinkContentResult = `❌ ${toolCall.name}: 执行失败: ${result.error}`;
              }
              controller.enqueue(tagGenerator.generateThink(thinkContentResult));

              // 格式化工具结果
              if (toolCall.name === 'search_articles' && result.success && result.data) {
                // 对于搜索工具，格式化结果为包含链接的上下文
                const formattedContext = formatSearchResults(
                  result.data as {
                    query: string;
                    results: Array<{
                      postId: number;
                      title: string;
                      url: string | null;
                      chunks: Array<{
                        chunkIndex: number;
                        chunkText: string;
                        score: number;
                      }>;
                    }>;
                  },
                  baseUrl
                );
                toolResults.push(formattedContext);
              } else {
                // 其他工具使用 XML 格式
                const toolResultXml = formatToolResult(toolCall.name, result);
                toolResults.push(toolResultXml);
              }
            }

            // 将 AI 响应（包含思考过程）和工具结果添加到消息历史
            if (responseWithoutTools.trim()) {
              messages.push({
                role: 'assistant',
                content: responseWithoutTools.trim(),
              });
            }

            // 添加工具结果作为用户消息（让 AI 继续处理）
            const toolResultsText = toolResults.join('\n\n');
            messages.push({
              role: 'user',
              content: toolResultsText + '\n\n请基于以上信息继续回答用户的问题。',
            });

            console.log(`✅ 工具执行完成，继续下一轮对话`);
          }

          // 如果达到最大轮数且还没有最终响应，使用流式调用生成最后一轮响应
          if (!hasFinalResponse) {
            console.log('⚠️ 达到最大轮数，使用流式调用生成最终响应');
            
            // 发送 content 标签开始
            controller.enqueue(tagGenerator.startContent());

            // 使用流式调用生成最终响应
            const streamResponse = await streamAnthropicMessagesWithSystem(
              systemInstruction,
              messages,
              aiModelConfig
            );

            // 读取流式响应并实时转发
            const reader = streamResponse.getReader();
            const decoder = new TextDecoder();
            
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                // 解码并发送内容块
                const text = decoder.decode(value, { stream: true });
                if (text) {
                  controller.enqueue(tagGenerator.generateContent(text));
                }
              }
            } finally {
              reader.releaseLock();
            }

            // 发送 content 标签结束
            controller.enqueue(tagGenerator.endContent());
          }

          console.log(`✅ ReAct 循环完成，工具调用次数: ${toolCallCount}`);

          controller.close();
        } catch (error) {
          console.error('❌ 流式响应错误:', error);
          controller.error(error instanceof Error ? error : new Error('流式响应失败'));
        }
      },
      cancel() {
        console.log('⚠️ 流式响应被取消');
      },
    });

    return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Access-Control-Allow-Origin': '*',
          'X-Content-Type-Options': 'nosniff',
        },
      });
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
