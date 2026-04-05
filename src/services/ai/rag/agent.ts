/**
 * RAG Agent 服务
 * 使用 ReAct 范式驱动 RAG 流程
 * 支持多轮思考、动态检索参数、查询改写
 */

import { createReactAgent, type ReactAgentConfig, type HistoryMessage } from '@/lib/react-agent';
import { createOpenAIModel } from '@/lib/ai';
import { getAllTags } from '@/services/tag';
import { StreamTagGenerator } from '@/lib/stream-tags';
import '@/services/ai/tools/register'; // 确保工具已注册

/**
 * RAG Agent 配置
 */
export interface RAGAgentParams {
  /** 用户问题 */
  question: string;
  /** 用户信息 */
  userInfo: string;
  /** 网站名称 */
  siteName: string;
  /** 当前时间 */
  currentTime: string;
  /** 网站地址 */
  baseUrl: string;
  /** 历史对话 */
  history?: HistoryMessage[];
  /** 模型场景 */
  scenario?: 'chat' | 'ai_text';
}

/**
 * 构建 RAG Agent 的系统提示词
 * 引导模型进行多轮思考，并输出 JSON-RPC 格式的工具调用
 */
async function buildRAGAgentSystemPrompt(
  params: Omit<RAGAgentParams, 'question' | 'history'>
): Promise<string> {
  const { userInfo, siteName, currentTime, baseUrl } = params;
  
  // 获取标签信息
  const articleTags = await getAllTags();
  const tags = articleTags.map((tag) => `${tag[0]}（${tag[1]}篇）`).join(', ');

  return `你是站长 NNNNzs 作为博客内容的回答器。博客是我的"人生之书"是一个媒介，一个连接"现在的我"、"过去的我"与"读者"的接口。
以主人公第一人称的视角回答问题，不要使用其他称呼，回答问题要富有艺术，追求质感，涵盖了用典、文艺与哲学感。

**网站信息：**
- 网站名称：${siteName}
- 网站地址：${baseUrl}
- 当前时间：${currentTime}

**登录用户状态：**
${userInfo}

**知识库标签和文章数量：**
${tags}

**你的能力：**
你有一个搜索工具可以查询博客文章。在回答问题之前，你需要先思考是否需要搜索文章。

**思考流程（ReAct 范式）：**
1. **Thought**：分析用户问题，判断是否需要检索文章。
   - 如果问题涉及博客内容、个人经历、技术文章等，需要检索
   - 如果是通用知识、闲聊等，可以直接回答
   - 根据问题复杂度决定检索数量（limit）：
     * 简单事实问题（如"Vue 3 有什么特性"）：limit=3-5
     * 复杂分析问题（如"聊聊我的技术成长"）：limit=8-12
     * 对比/总结类问题（如"2023年我去过哪些地方"）：limit=15-20
     * 旅游/回忆类问题（涉及多个主题）：limit=15-20

2. **Action**：如果需要检索，调用 search_articles 工具。
   - 优化查询：将口语化问题转换为更适合向量检索的关键词
   - 设置合适的 limit 参数

3. **Observation**：查看检索结果。
   - 如果结果足够，进入步骤 4
   - 如果结果不理想（数量少或相关度低），可以改写查询再次检索

4. **Answer**：基于检索结果生成最终答案。

**重要：工具调用格式（JSON-RPC 2.0）**
当你需要调用工具时，必须使用以下 JSON-RPC 格式，包裹在 \`\`\`json-rpc 代码块中：

\`\`\`json-rpc
{
  "jsonrpc": "2.0",
  "method": "search_articles",
  "params": {
    "query": "搜索关键词",
    "limit": 5
  },
  "id": 1
}
\`\`\`

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
 * RAG Agent 聊天（流式响应，带思考过程展示）
 * @param params RAG Agent 参数
 * @returns ReadableStream 流式响应
 */
export const chatRAGAgentStream = async (
  params: RAGAgentParams
): Promise<ReadableStream> => {
  const { question, history = [], scenario = 'chat' } = params;

  // 参数验证
  if (!question || question.trim().length === 0) {
    throw new Error('问题内容不能为空');
  }

  const tagGenerator = new StreamTagGenerator();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        // 状态提示
        controller.enqueue(tagGenerator.generateThink('正在初始化 RAG Agent...'));

        const systemPrompt = await buildRAGAgentSystemPrompt(params);

        // 创建模型实例
        const model = await createOpenAIModel({ scenario });

        // 创建 ReAct Agent
        const agentConfig: ReactAgentConfig = {
          model,
          systemPrompt,
          maxIterations: 5,
          verbose: true,
        };

        const agent = createReactAgent(agentConfig);

        controller.enqueue(tagGenerator.generateThink('开始思考和检索...'));

        // ReAct 循环状态追踪
        let stepIndex = 0;
        let inThoughtStep = false;

        // 运行 Agent
        await agent.run({
          input: question,
          history,
          onEvent: async (event) => {
            switch (event.type) {
              case 'thought': {
                // 模型流式输出思考内容
                const text = typeof event.data === 'string' ? event.data : '';
                if (text) {
                  if (!inThoughtStep) {
                    // 开始新的 thought step
                    stepIndex++;
                    inThoughtStep = true;
                    controller.enqueue(tagGenerator.startStep('thought', stepIndex));
                  }
                  controller.enqueue(encoder.encode(text));
                }
                break;
              }

              case 'action': {
                // 结束流式 thought step
                if (inThoughtStep) {
                  controller.enqueue(tagGenerator.endStep());
                  inThoughtStep = false;
                }

                const actionData = event.data as { method?: string; params?: Record<string, unknown> };
                if (actionData.method === 'search_articles') {
                  const query = actionData.params?.query || '';
                  const limit = actionData.params?.limit || 5;
                  controller.enqueue(
                    tagGenerator.generateStep('action', stepIndex, `搜索文章：${query}（共 ${limit} 篇）`)
                  );
                }
                break;
              }

              case 'observation': {
                const obsData = event.data as { result?: { results?: Array<{ title: string; score?: number }> } };
                if (obsData.result?.results) {
                  const results = obsData.result.results;
                  const resultText = results
                    .map((r, i) => `${i + 1}. ${r.title}`)
                    .join('\n');
                  controller.enqueue(
                    tagGenerator.generateStep('observation', stepIndex, `找到 ${results.length} 篇相关文章：\n${resultText}`)
                  );
                }
                break;
              }

              case 'answer': {
                // 结束可能未关闭的 thought step
                if (inThoughtStep) {
                  controller.enqueue(tagGenerator.endStep());
                  inThoughtStep = false;
                }
                // 开始 content 标签输出最终答案
                controller.enqueue(tagGenerator.startContent());
                const answerText = typeof event.data === 'string' ? event.data : '';
                if (answerText) {
                  controller.enqueue(encoder.encode(answerText));
                }
                break;
              }

              case 'error': {
                if (inThoughtStep) {
                  controller.enqueue(tagGenerator.endStep());
                  inThoughtStep = false;
                }
                const errorData = event.data as { message?: string };
                console.error('RAG Agent 错误:', errorData.message);
                controller.enqueue(
                  tagGenerator.generateThink(`处理出错：${errorData.message}`)
                );
                break;
              }

              case 'done': {
                if (inThoughtStep) {
                  controller.enqueue(tagGenerator.endStep());
                  inThoughtStep = false;
                }
                controller.enqueue(tagGenerator.endContent());
                controller.close();
                break;
              }
            }
          },
        });
      } catch (error) {
        console.error('RAG Agent 运行失败:', error);
        controller.enqueue(
          tagGenerator.generateThink(`RAG Agent 运行失败：${error instanceof Error ? error.message : '未知错误'}`)
        );
        controller.error(error);
      }
    },
  });
};
