/**
 * 聊天 API 路由
 * POST /api/chat
 * 支持知识库检索和流式响应
 */

import { NextRequest, NextResponse } from 'next/server';
import { embedText } from '@/services/embedding/embedding';
import { searchSimilarVectors } from '@/services/embedding/vector-store';
import { getPostById } from '@/services/post';
import { getBaseUrl, getUserFromToken } from '@/lib/auth';
import {
  streamAnthropicMessagesWithSystem,
  type AnthropicModelConfig,
} from '@/services/ai/anthropic';
import { StreamTagGenerator } from '@/lib/stream-tags';
import dayjs from 'dayjs';

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
 * 检索过程信息类型（用于展示检索步骤，而非AI思考过程）
 */
interface RetrievalStep {
  step: string;
  content: string;
  timestamp: number;
}

/**
 * 创建检索过程流式响应
 * 使用标签生成器生成符合规范的标签格式
 */
function createRetrievalStepsStream(
  retrievalSteps: RetrievalStep[],
  aiResponse: ReadableStream
): ReadableStream {
  const tagGenerator = new StreamTagGenerator();
  const decoder = new TextDecoder();

  // 将检索过程转换为 think 标签格式
  const thinkContent = retrievalSteps
    .map((step) => `${step.step}: ${step.content}`)
    .join('\n');

  console.log('📤 发送检索过程信息（think 标签格式），共', retrievalSteps.length, '步');

  // 然后转发 AI 响应
  const reader = aiResponse.getReader();

  return new ReadableStream({
    async start(controller) {
      try {
        // 先发送检索过程（think 标签）
        const thinkTag = tagGenerator.generateThink(thinkContent);
        controller.enqueue(thinkTag);
        console.log('✅ 检索过程信息已发送（think 标签格式）');

        // 发送 content 标签开始
        controller.enqueue(tagGenerator.startContent());

        // 然后直接转发 AI 流式响应内容，同时过滤掉 think 标签
        let chunkCount = 0;
        let totalBytes = 0;
        let buffer = ''; // 用于处理跨块的 think 标签
        let inThinkTag = false; // 标记是否在 think 标签内
        console.log('🔄 开始读取 AI 流式响应...');
        
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // 处理剩余的缓冲区（不在 think 标签内的内容）
            if (buffer && !inThinkTag) {
              controller.enqueue(tagGenerator.generateContent(buffer));
            }
            
            // 发送 content 标签结束
            controller.enqueue(tagGenerator.endContent());
            console.log(`✅ AI 流式响应完成，共处理 ${chunkCount} 个数据块，总字节数: ${totalBytes}`);
            if (chunkCount === 0) {
              console.warn('⚠️ 警告：AI 流式响应没有返回任何数据！');
            }
            controller.close();
            break;
          }

          if (value) {
            chunkCount++;
            totalBytes += value.length;
            
            // 解码数据
            const text = decoder.decode(value, { stream: true });
            buffer += text;
            
            // 处理 think 标签
            while (true) {
              if (!inThinkTag) {
                // 查找 <think> 标签开始
                const thinkStart = buffer.indexOf('<think>');
                if (thinkStart !== -1) {
                  // 发送 think 标签之前的内容
                  if (thinkStart > 0) {
                    controller.enqueue(tagGenerator.generateContent(buffer.substring(0, thinkStart)));
                  }
                  // 移除已处理的部分和 <think> 标签
                  buffer = buffer.substring(thinkStart + 7);
                  inThinkTag = true;
                  console.log('🔍 检测到 think 标签开始，已过滤');
                  continue;
                }
              }
              
              if (inThinkTag) {
                // 查找 </think> 标签结束
                const thinkEnd = buffer.indexOf('</think>');
                if (thinkEnd !== -1) {
                  // 移除 think 标签内容（包括 </think>）
                  buffer = buffer.substring(thinkEnd + 8);
                  inThinkTag = false;
                  console.log('🔍 检测到 think 标签结束，已过滤');
                  continue;
                }
              }
              
              // 如果没有找到更多标签，发送可以安全发送的内容
              if (!inThinkTag && buffer.length > 0) {
                // 如果 buffer 中可能还有未完成的 <think>，保留最后几个字符
                const safeLength = buffer.length > 7 ? buffer.length - 7 : 0;
                if (safeLength > 0) {
                  controller.enqueue(tagGenerator.generateContent(buffer.substring(0, safeLength)));
                  buffer = buffer.substring(safeLength);
                }
              }
              
              break;
            }
            
            // 前几个块和每 50 个块输出一次日志（减少日志频率）
            if (chunkCount <= 3 || chunkCount % 50 === 0) {
              const preview = text.substring(0, Math.min(50, text.length));
              console.log(`📤 已发送 ${chunkCount} 个数据块，当前块长度: ${text.length}，内容预览: ${preview}...`);
            }
          } else {
            console.warn(`⚠️ 第 ${chunkCount + 1} 次读取到空值`);
          }
        }
      } catch (error) {
        console.error('❌ 流式响应错误:', error);
        if (error instanceof Error) {
          console.error('错误堆栈:', error.stack);
        }
        const errorMessage = error instanceof Error ? error.message : 'AI处理失败';
        controller.error(new Error(errorMessage));
      }
    },
    cancel() {
      console.log('⚠️ 流式响应被取消');
      reader.cancel();
    },
  });
}

/**
 * 聊天 API
 * POST /api/chat
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
    
    // 检索过程信息（用于前端展示）
    const retrievalSteps: RetrievalStep[] = [];

    // 步骤1: 分析用户问题
    retrievalSteps.push({
      step: '分析',
      content: `正在分析用户问题：「${message}」`,
      timestamp: Date.now(),
    });

    // 步骤2: 将用户消息转换为向量
    retrievalSteps.push({
      step: '向量化',
      content: '正在将问题转换为向量表示...',
      timestamp: Date.now(),
    });

    let queryVector: number[];
    try {
      queryVector = await embedText(message);
      retrievalSteps.push({
        step: '向量化',
        content: '✅ 向量化完成',
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('向量化失败:', error);
      return NextResponse.json(
        {
          status: false,
          message: error instanceof Error ? error.message : '向量化失败',
        },
        { status: 500 }
      );
    }

    // 步骤3: 从知识库检索相关文章
    retrievalSteps.push({
      step: '检索',
      content: '正在从知识库检索相关文章...',
      timestamp: Date.now(),
    });

    let searchResults: Array<{
      postId: number;
      chunkIndex: number;
      chunkText: string;
      title: string;
      score: number;
    }> = [];

    try {
      searchResults = await searchSimilarVectors(queryVector, 5); // 检索前5个最相关的结果

      if (searchResults.length > 0) {
        retrievalSteps.push({
          step: '检索',
          content: `✅ 找到 ${searchResults.length} 篇相关文章片段`,
          timestamp: Date.now(),
        });

        // 记录检索到的文章信息（包含链接）
        const uniquePostIds = [...new Set(searchResults.map(r => r.postId))];
        const postInfos = await Promise.all(
          uniquePostIds.map(async (postId) => {
            const post = await getPostById(postId);
            if (post) {
              const postUrl = post.path ? `${baseUrl}${post.path}` : null;
              return {
                title: post.title || `文章 ${postId}`,
                url: postUrl,
              };
            }
            return {
              title: `文章 ${postId}`,
              url: null,
            };
          })
        );

        const postTitles = postInfos.map(info => info.title).join('、');
        retrievalSteps.push({
          step: '检索',
          content: `相关文章：${postTitles}`,
          timestamp: Date.now(),
        });
      } else {
        retrievalSteps.push({
          step: '检索',
          content: '⚠️ 未找到相关文章，将使用通用知识回答',
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error('检索失败:', error);
      retrievalSteps.push({
        step: '检索',
        content: '⚠️ 检索失败，将使用通用知识回答',
        timestamp: Date.now(),
      });
    }

    // 步骤4: 准备生成回答
    retrievalSteps.push({
      step: '生成',
      content: '正在生成回答...',
      timestamp: Date.now(),
    });

    // 构建上下文信息（包含文章链接）
    let contextText = '';
    if (searchResults.length > 0) {
      // 获取所有相关文章的完整信息（包括 URL）
      const postInfoMap = new Map<number, { title: string; url: string | null }>();
      
      const uniquePostIds = [...new Set(searchResults.map(r => r.postId))];
      await Promise.all(
        uniquePostIds.map(async (postId) => {
          const post = await getPostById(postId);
          if (post) {
            const postUrl = post.path ? `${baseUrl}${post.path}` : null;
            postInfoMap.set(postId, {
              title: post.title || `文章 ${postId}`,
              url: postUrl,
            });
          }
        })
      );

      // 构建包含链接的上下文
      const contextChunks = searchResults.map((result, index) => {
        const postInfo = postInfoMap.get(result.postId);
        const postTitle = postInfo?.title || result.title;
        const postUrl = postInfo?.url;
        
        // 如果有 URL，使用 Markdown 链接格式
        const titleWithLink = postUrl 
          ? `[${postTitle}](${postUrl})`
          : postTitle;
        
        return `[片段 ${index + 1}] 来自文章《${titleWithLink}》\n${result.chunkText}`;
      }).join('\n\n');

      contextText = `以下是从知识库中检索到的相关内容：\n\n${contextChunks}\n\n请基于以上内容回答用户的问题。如果相关内容不足以回答问题，可以结合你的通用知识进行回答。`;
    }

    console.log('🤖 开始生成 AI 回答，上下文长度:', contextText.length);

    // 构建通用信息
    const userInfo = user 
      ? `用户已登录，昵称：${user.nickname || user.account}${user.role ? `（${user.role}）` : ''}`
      : '用户未登录（游客模式）';

    // 构建系统指令（包含通用信息）
    const systemInstruction = `你是一个智能助手，擅长基于知识库内容回答用户问题。

**当前上下文信息：**
- 网站名称：${siteName}
- 当前时间：${currentTime}
- 用户状态：${userInfo}
- 网站地址：${baseUrl}

**回答要求：**
1. **优先使用知识库**：优先使用知识库中检索到的相关内容回答问题
2. **结合通用知识**：如果知识库内容不足以回答问题，可以结合你的通用知识进行补充
3. **回答质量**：回答要准确、清晰、有帮助，逻辑清晰
4. **引用格式**：**重要：当引用知识库中的文章时，必须使用 Markdown 链接格式 [文章标题](文章URL) 来引用**
   - 例如：更多信息请参考[这篇文章](https://example.com/2024/12/25/article-title)
   - 链接会在新标签页打开，用户可以直接点击访问
5. **来源说明**：如果引用了知识库内容，应该说明来源并附上链接
6. **语言要求**：使用中文回答
7. **重要：不要使用 <think> 标签**：检索过程已经通过系统展示，你只需要直接回答问题即可

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

    // 构建当前用户消息（包含上下文）
    let userMessageContent = '';
    if (contextText) {
      userMessageContent = `${contextText}\n\n用户问题：${message}`;
    } else {
      userMessageContent = message;
    }

    messages.push({
      role: 'user',
      content: userMessageContent,
    });

    // 创建 Anthropic 模型配置
    const aiModelConfig: AnthropicModelConfig = {
      temperature: 0.7,
      maxTokens: 2000,
    };

    // 生成流式响应
    console.log('🔄 调用 Anthropic API 生成流式响应...');
    console.log('📝 系统指令长度:', systemInstruction.length);
    console.log('📝 消息数量:', messages.length);
    console.log('📝 最后一条消息长度:', messages[messages.length - 1]?.content.length || 0);
    
    try {
      const aiStream = await streamAnthropicMessagesWithSystem(
        systemInstruction,
        messages,
        aiModelConfig
      );
      console.log('✅ AI 流式响应已创建，类型:', typeof aiStream, 'locked:', aiStream.locked);
      
      // 创建包含检索过程的流式响应
      const streamWithRetrievalSteps = createRetrievalStepsStream(retrievalSteps, aiStream);
      console.log('✅ 包含检索过程的流式响应已创建');
      
      // 直接返回文本流（不再是 SSE 格式）
      return new Response(streamWithRetrievalSteps, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Access-Control-Allow-Origin': '*',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (streamError) {
      console.error('❌ 创建 AI 流式响应失败:', streamError);
      if (streamError instanceof Error) {
        console.error('错误堆栈:', streamError.stack);
      }
      throw streamError;
    }
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
