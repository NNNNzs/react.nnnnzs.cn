/**
 * RAG Agent 服务
 * 使用 ReAct 范式驱动 RAG 流程
 * 支持多轮思考、动态检索参数、查询改写
 */

import { createReactAgent, type ReactAgentConfig, type HistoryMessage } from '@/lib/react-agent';
import { createOpenAIModel } from '@/lib/ai';
import { getAllTags } from '@/services/tag';
import { getAllCollectionsSummary } from '@/services/collection';
import { toolRegistry } from '@/services/ai/tools';
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

  // 按文章数量排序，方便模型理解分布
  const sortedTags = [...articleTags].sort((a, b) => b[1] - a[1]);
  const tagCount = articleTags.length;
  const totalArticles = articleTags.reduce((sum, [, count]) => sum + count, 0);

  // 格式化标签列表，突出显示主要标签
  const formatTags = () => {
    if (sortedTags.length === 0) return '暂无标签';

    // 前 5 个标签单独列出
    const topTags = sortedTags.slice(0, 5).map(([tag, count]) => `${tag}（${count}篇）`).join('、');
    const remaining = sortedTags.length - 5;

    if (remaining > 0) {
      return `${topTags}等 ${tagCount} 个标签（共 ${totalArticles} 篇文章）`;
    }
    return `${topTags}（共 ${totalArticles} 篇文章）`;
  };

  // 获取合集信息
  const collections = await getAllCollectionsSummary();

  // 格式化合集信息
  const formatCollections = () => {
    if (collections.length === 0) return '暂无合集';

    const collectionList = collections
      .slice(0, 10)
      .map((col) => {
        const desc = col.description ? ` - ${col.description}` : '';
        return `• 《${col.title}》（${col.articleCount} 篇）${desc}`;
      })
      .join('\n');

    if (collections.length > 10) {
      return `${collectionList}\n... 等共 ${collections.length} 个合集`;
    }
    return collectionList;
  };

  // 计算检索量建议的基准值
  const getLimitGuidelines = () => {
    if (sortedTags.length === 0) return 'limit=5（默认）';

    const medianCount = sortedTags[Math.floor(sortedTags.length / 2)][1];
    const maxCount = sortedTags[0][1];

    // 生成智能化的 limit 建议
    return `**核心原则：根据涉及标签的实际文章数量设置 limit**
     - 如果问题涉及某个标签，limit 应该接近或等于该标签的文章数量
     - 例如：若用户询问"忧伤感怀"，该标签有 43 篇文章，则 limit 应设为 40-45
     - 例如：若用户询问"技术"相关，该标签有 47 篇文章，则 limit 应设为 45-50
     - 如果问题涉及多个标签，limit 可以设置为各标签文章数的总和

     **参考建议**：
     * 小标签（<10 篇）：limit 设为该标签的全部文章数
     * 中等标签（10-30 篇）：limit 设为该标签文章数的 80%-100%
     * 大标签（>30 篇）：limit 设为该标签文章数的 70%-90%，避免上下文过长

     **特殊场景**：
     * 通用闲聊：limit=3-5 即可
     * 确认事实：limit=5-10 即可`;
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

**你的能力：**
你有两个搜索工具可以查询博客文章。在回答问题之前，你需要先思考是否需要搜索文章。

**可用工具：**
1. **search_articles** - 基于向量相似度的语义搜索（理解问题意图）
2. **search_posts_meta** - 按时间、热度、分类等维度查询（结构化查询）
3. **search_collection** - 指定合集中的文章搜索

**思考流程（ReAct 范式）：**
1. **Thought**：分析用户问题，判断检索策略。
   - 如果问题涉及博客内容、个人经历、技术文章等，需要检索
   - 如果是通用知识、闲聊等，可以直接回答
   - **工具选择**：
     * 时间/热度相关问题（"最近在忙什么"、"最受欢迎的文章"、"2024年的文章"）→ 使用 search_posts_meta
     * 语义理解问题（"忧伤感怀表达了什么"、"你如何看待技术"）→ 使用 search_articles
     * 合集相关问题 → 使用 search_collection
   - **设置 limit**：
     ${getLimitGuidelines()}

2. **Action**：选择合适的工具并设置参数。
   - **结构化查询（search_posts_meta）**：
     * sort_by: "date"（发布时间）、"updated"（更新时间）、"visitors"（浏览量）、"likes"（点赞数）
     * sort_order: "desc"（降序）、"asc"（升序）
     * date_from/date_to: 时间范围，如 "2024-01-01"
     * tags: 标签筛选
     * category: 分类筛选
     * limit: 10-30 即可
   - **语义搜索（search_articles）**：
     * query: 问题关键词或标签名
     * limit: 根据标签文章数量设置，不要吝啬
   - **合集搜索（search_collection）**：
     * collection: 合集的 slug 标识符
     * query: 可选的筛选关键词

3. **Observation**：查看检索结果。
   - 如果结果足够，进入步骤 4
   - 如果结果不理想，改写查询再次检索

4. **Answer**：基于检索结果生成最终答案。

${toolRegistry.getToolsDescription()}

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
