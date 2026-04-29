/**
 * LangGraph ReAct Agent 实现
 * 使用 createReactAgent + streamEvents 替代手写 ReAct 循环
 * 复用现有的 XML 标签流式协议（StreamTagGenerator），前端无需改动
 */

import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { createOpenAIModel } from '@/lib/ai';
import { chatTools } from '@/services/ai/tools/langchain-tools';
import { StreamTagGenerator, type StepType } from '@/lib/stream-tags';
import { getAllTags } from '@/services/tag';
import { getAllCollectionsSummary } from '@/services/collection';

/**
 * RAG Agent 配置（与原 agent.ts 保持一致）
 */
export interface RAGAgentParams {
  question: string;
  userInfo: string;
  siteName: string;
  currentTime: string;
  baseUrl: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  scenario?: 'chat' | 'ai_text';
}

/**
 * 构建 LangGraph Agent 的系统提示词
 * 与原 buildRAGAgentSystemPrompt 逻辑一致，但移除了 JSON-RPC 格式说明
 * （原生 Function Calling 由 LangChain 自动处理）
 */
async function buildAgentSystemPrompt(
  params: Omit<RAGAgentParams, 'question' | 'history'>,
): Promise<string> {
  const { userInfo, siteName, currentTime, baseUrl } = params;

  const articleTags = await getAllTags();
  const sortedTags = [...articleTags].sort((a, b) => b[1] - a[1]);
  const tagCount = articleTags.length;
  const totalArticles = articleTags.reduce((sum, [, count]) => sum + count, 0);

  const formatTags = () => {
    if (sortedTags.length === 0) return '暂无标签';
    const topTags = sortedTags.slice(0, 5).map(([tag, count]) => `${tag}（${count}篇）`).join('、');
    const remaining = sortedTags.length - 5;
    if (remaining > 0) return `${topTags}等 ${tagCount} 个标签（共 ${totalArticles} 篇文章）`;
    return `${topTags}（共 ${totalArticles} 篇文章）`;
  };

  const collections = await getAllCollectionsSummary();

  const formatCollections = () => {
    if (collections.length === 0) return '暂无合集';
    const collectionList = collections
      .slice(0, 10)
      .map((col) => {
        const desc = col.description ? ` - ${col.description}` : '';
        return `• 《${col.title}》（${col.articleCount} 篇）${desc}`;
      })
      .join('\n');
    if (collections.length > 10) return `${collectionList}\n... 等共 ${collections.length} 个合集`;
    return collectionList;
  };

  const getLimitGuidelines = () => {
    if (sortedTags.length === 0) return 'limit=5（默认）';
    return `**核心原则：根据涉及标签的实际文章数量设置 limit**
     - 如果问题涉及某个标签，limit 应该接近或等于该标签的文章数量
     - 小标签（<10 篇）：limit 设为该标签的全部文章数
     - 中等标签（10-30 篇）：limit 设为该标签文章数的 80%-100%
     - 大标签（>30 篇）：limit 设为该标签文章数的 70%-90%
     - 通用闲聊：limit=3-5 即可`;
  };

  return `你是站长 NNNNzs 作为博客内容的回答器。博客是我的"人生之书"是一个媒介，一个连接"现在的我"、"过去的我"与"读者"的接口。
以主人公第一人称的视角回答问题，不要使用其他称呼，回答问题要富有艺术，追求质感，涵盖了用典、文艺与哲学感。

**网站信息：**
- 网站名称：${siteName}
- 网站地址：${baseUrl}
- 当前时间：${currentTime}

**登录用户状态：**
${userInfo}

**知识库规模：**
${formatTags()}

**文章合集：**
${formatCollections()}

**思考流程：**
在回答问题之前，先思考是否需要搜索文章。
- 如果问题涉及博客内容、个人经历、技术文章等，需要检索
- 如果是通用知识、闲聊等，可以直接回答

**工具选择策略：**
- 时间/热度相关问题（"最近在忙什么"、"最受欢迎的文章"）→ 使用 search_posts_meta
- 语义理解问题（"忧伤感怀表达了什么"、"你如何看待技术"）→ 使用 search_articles
- 合集相关问题 → 使用 search_collection

**limit 设置指南：**
${getLimitGuidelines()}

**回答要求：**
1. **仅基于检索到的知识库内容回答问题** - 不要编造或使用外部信息
2. **诚实告知** - 如果知识库中没有相关信息，可以说："这一页似乎还是空白，可能我还需要更多的人生去书写它。"
3. **引用格式** - 引用文章时，给出具体链接，使用"—— 摘自《[文章标题](文章链接地址)》" 的 markdown 格式链接
4. **准确简洁** - 答案要准确、简洁、有帮助
5. **使用中文** - 使用中文回答所有问题
6. **结构化** - 如果回答多个要点，使用分条列举的形式

**特别说明：**
- 用户询问的是关于博客文章、技术文档或知识库内容的问题
- 请仔细思考后再决定是否需要检索
- 如果找到相关信息，基于这些信息回答
- 如果未找到相关信息，诚实告知用户
- 必须给出引用来源`;
}

/**
 * 从 LangGraph streamEvents 的 tool 结果中提取展示文本
 */
function extractObservationText(data: unknown): string {
  const event = data as Record<string, unknown> | undefined;
  if (!event) return '';

  // on_tool_end 的 data.output 可能是 LangChain 序列化对象
  // 实际内容在 lc_kwargs.content 或直接 content
  const output = event.output as Record<string, unknown> | undefined;
  if (!output) return '';

  const kw = (output.lc_kwargs as Record<string, unknown>) || output;
  const content = (kw.content as string) || '';

  if (!content) return '';

  try {
    const parsed = JSON.parse(content);

    // search_articles 格式：{ query, results: [{ title, chunks }], totalResults }
    if (Array.isArray(parsed.results) && parsed.results.length > 0) {
      const total = parsed.totalResults || parsed.results.length;
      const titles = parsed.results.slice(0, 5)
        .map((r: { title?: string }, i: number) => `${i + 1}. ${r.title || '未知文章'}`)
        .join('\n');
      return `找到 ${total} 篇相关文章：\n${titles}`;
    }

    // search_posts_meta 格式：{ results: [...], total, message }
    if (parsed.results && typeof parsed.total === 'number') {
      return `${parsed.message || `找到 ${parsed.total} 篇文章`}`;
    }

    // search_collection 格式：{ message }
    if (parsed.message) return parsed.message;

    return content.slice(0, 200);
  } catch {
    return content.slice(0, 200);
  }
}

/**
 * 从 tool_calls chunk 中提取工具名和参数
 */
function extractToolCallInfo(toolCalls: Array<{ name?: string; args?: Record<string, unknown> }>): string {
  if (toolCalls.length === 0) return '';
  const tc = toolCalls[0];
  const name = tc.name || 'unknown';
  const args = tc.args || {};
  if (name === 'search_articles') return `搜索文章：${args.query || ''}（共 ${args.limit || 5} 篇）`;
  if (name === 'search_posts_meta') return `查询文章列表（${args.sort_by || 'date'} ${args.sort_order || 'desc'}）`;
  if (name === 'search_collection') return `搜索合集：${args.collection || ''}`;
  return `${name}(${JSON.stringify(args).slice(0, 80)})`;
}

/**
 * 流式响应阶段
 */
type Phase = 'init' | 'thinking' | 'answering';

/**
 * RAG Agent 聊天（基于 LangGraph）
 * 返回与原 chatRAGAgentStream 相同的 XML 标签流式协议
 */
export const chatRAGAgentStream = async (
  params: RAGAgentParams,
): Promise<ReadableStream> => {
  const { question, history = [], scenario = 'chat' } = params;

  if (!question || question.trim().length === 0) {
    throw new Error('问题内容不能为空');
  }

  const tagGenerator = new StreamTagGenerator();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(tagGenerator.generateThink('正在初始化 RAG Agent...'));

        const systemPrompt = await buildAgentSystemPrompt(params);
        const model = await createOpenAIModel({ scenario });

        const agent = createReactAgent({
          llm: model.bindTools(chatTools),
          tools: chatTools,
          prompt: systemPrompt,
        });

        controller.enqueue(tagGenerator.generateThink('开始思考和检索...'));

        // 构建消息历史
        const messages: Array<HumanMessage | AIMessage> = [];
        for (const h of history) {
          if (h.role === 'user') {
            messages.push(new HumanMessage(h.content));
          } else {
            messages.push(new AIMessage(h.content));
          }
        }
        messages.push(new HumanMessage(question));

        // 状态追踪
        let stepIndex = 0;
        let inThoughtStep = false;
        let inContentTag = false;
        let hasToolExecuted = false;
        let phase: Phase = 'init';

        // 遍历 streamEvents
        const eventStream = agent.streamEvents(
          { messages },
          { version: 'v2' },
        );

        for await (const event of eventStream) {
          const { event: eventType, name, data } = event;

          // === 模型流式输出 ===
          if (eventType === 'on_chat_model_stream') {
            const chunk = data?.chunk;
            if (!chunk) continue;

            const content = chunk.content;
            const toolCalls = chunk.tool_calls || [];

            // 有 tool_calls：模型决定调用工具
            if (toolCalls.length > 0) {
              // 关闭可能未完成的 thought step
              if (inThoughtStep) {
                controller.enqueue(tagGenerator.endStep());
                inThoughtStep = false;
              }
              // 关闭可能未完成的 content 标签（模型先回答后决定调用工具）
              if (inContentTag) {
                controller.enqueue(tagGenerator.endContent());
                inContentTag = false;
              }

              stepIndex++;
              const toolInfo = extractToolCallInfo(toolCalls);
              controller.enqueue(
                tagGenerator.generateStep('action', stepIndex, toolInfo),
              );

              phase = 'init';
              hasToolExecuted = true;
              continue;
            }

            // 有文本内容（不含 .trim()，避免过滤掉 \n 等空白字符 chunk）
            if (content && typeof content === 'string') {
              // 之前执行过工具：这是工具调用后的最终答案
              if (hasToolExecuted) {
                if (phase !== 'answering') {
                  phase = 'answering';
                  if (inThoughtStep) {
                    controller.enqueue(tagGenerator.endStep());
                    inThoughtStep = false;
                  }
                  if (!inContentTag) {
                    controller.enqueue(tagGenerator.startContent());
                    inContentTag = true;
                  }
                }
              }
              // 还没执行过工具的文本 = 直接回答，用 content 标签
              else {
                if (!inContentTag) {
                  controller.enqueue(tagGenerator.startContent());
                  inContentTag = true;
                }
              }

              // 输出文本
              controller.enqueue(encoder.encode(content));
              continue;
            }
          }

          // === 工具执行完成 ===
          if (eventType === 'on_tool_end') {
            const obsText = extractObservationText(data);
            controller.enqueue(
              tagGenerator.generateStep('observation', stepIndex, obsText),
            );
            continue;
          }
        }

        // 清理：关闭可能未完成的标签
        if (inThoughtStep) {
          controller.enqueue(tagGenerator.endStep());
        }
        if (inContentTag) {
          controller.enqueue(tagGenerator.endContent());
        }

        controller.close();
      } catch (error) {
        console.error('LangGraph Agent 运行失败:', error);
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        controller.enqueue(tagGenerator.generateThink(`处理出错：${errorMsg}`));
        controller.error(error);
      }
    },
  });
};
