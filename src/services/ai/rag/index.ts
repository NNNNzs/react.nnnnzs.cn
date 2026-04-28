/**
 * RAG (Retrieval-Augmented Generation) 服务
 * 基于 LangChain 实现，复用现有的 AI 模块和向量检索
 *
 * 架构：
 * 1. 向量检索相关文章
 * 2. 构建提示词（注入检索到的上下文）
 * 3. 调用 LLM 生成答案
 * 4. 带标签的流式返回（展示中间步骤）
 */

// 导出 RAG Agent 服务（ReAct 范式）—— 使用 LangGraph 实现
export { chatRAGAgentStream } from './langgraph-agent';
export type { RAGAgentParams } from './langgraph-agent';

// 旧版手写 ReAct Agent（保留，不再使用）
// export { chatRAGAgentStream } from './agent';
// export type { RAGAgentParams } from './agent';

import { ChatPromptTemplate, createAIChain } from '@/lib/ai';
import { embedText } from '@/services/embedding/embedding';
import { searchSimilarVectors } from '@/services/embedding/vector-store';
import { getPostById } from '@/services/post';
import { getAllTags } from '@/services/tag';
import { StreamTagGenerator } from '@/lib/stream-tags';

/**
 * 文章搜索结果
 */
interface ArticleSearchResult {
  postId: number;
  title: string;
  url: string | null;
  score: number;
  chunks: Array<{
    chunkIndex: number;
    chunkText: string;
    score: number;
  }>;
}

/**
 * 检索结果（用于注入提示词）
 */
interface RetrievalContext {
  query: string;
  articles: Array<{
    title: string;
    url: string | null;
    relevantChunks: string[];
    score: number;
  }>;
  totalArticles: number;
}

/**
 * 向量检索相关文章
 * @param query 用户查询
 * @param limit 返回文章数量限制
 * @returns 检索结果
 */
async function retrieveRelevantArticles(
  query: string,
  limit: number = 5
): Promise<RetrievalContext> {
  try {
    // 1. 将查询文本转换为向量
    const queryVector = await embedText(query);

    // 2. 搜索相似向量（带重试机制）
    let searchResults: Array<{
      postId: number;
      chunkIndex: number;
      chunkText: string;
      title: string;
      score: number;
    }>;

    try {
      searchResults = await searchSimilarVectors(queryVector, limit, undefined, 2);
    } catch (searchError) {
      const errorMessage = searchError instanceof Error ? searchError.message : String(searchError);
      const isTimeoutError =
        errorMessage.includes('timeout') ||
        errorMessage.includes('TIMEOUT') ||
        errorMessage.includes('Connect Timeout');

      if (isTimeoutError) {
        console.error('❌ 向量搜索超时，可能是 Qdrant 服务不可用或网络问题');
        throw new Error('向量搜索服务暂时不可用，请稍后重试');
      }

      throw searchError;
    }

    if (searchResults.length === 0) {
      return {
        query,
        articles: [],
        totalArticles: 0,
      };
    }

    // 3. 获取文章详细信息
    const uniquePostIds = [...new Set(searchResults.map((r) => r.postId))];
    const postInfoMap = new Map<number, { title: string; url: string | null }>();

    await Promise.all(
      uniquePostIds.map(async (postId) => {
        const post = await getPostById(postId);
        if (post) {
          postInfoMap.set(postId, {
            title: post.title || `文章 ${postId}`,
            url: post.path || null,
          });
        }
      })
    );

    // 4. 按文章分组并提取相关片段
    const articlesMap = new Map<number, ArticleSearchResult>();

    for (const result of searchResults) {
      const postInfo = postInfoMap.get(result.postId);
      if (!postInfo) continue;

      if (!articlesMap.has(result.postId)) {
        articlesMap.set(result.postId, {
          postId: result.postId,
          title: postInfo.title,
          url: postInfo.url,
          score: result.score,
          chunks: [],
        });
      }

      articlesMap.get(result.postId)!.chunks.push({
        chunkIndex: result.chunkIndex,
        chunkText: result.chunkText,
        score: result.score,
      });
    }

    // 5. 转换为最终格式（每个文章只保留 Top 3 相关片段）
    const articles = Array.from(articlesMap.values())
      .sort((a, b) => {
        const aMaxScore = Math.max(...a.chunks.map((c) => c.score));
        const bMaxScore = Math.max(...b.chunks.map((c) => c.score));
        return bMaxScore - aMaxScore;
      })
      .slice(0, limit)
      .map((article) => ({
        title: article.title,
        url: article.url,
        score: Math.max(...article.chunks.map((c) => c.score)),
        relevantChunks: article.chunks
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((c) => c.chunkText),
      }));

    return {
      query,
      articles,
      totalArticles: articles.length,
    };
  } catch (error) {
    console.error('❌ 向量检索失败:', error);
    throw error;
  }
}

/**
 * 构建提示词（包含检索上下文）
 */
function buildRAGPrompt(
  retrievalContext: RetrievalContext,
  userInfo: string,
  siteName: string,
  currentTime: string,
  baseUrl: string,
  tags: string
): ChatPromptTemplate {
  // 格式化检索到的文章内容
  let articlesContent = '';
  if (retrievalContext.totalArticles > 0) {
    articlesContent = retrievalContext.articles
      .map((article, index) => {
        const chunksText = article.relevantChunks
          .map((chunk, i) => `片段 ${i + 1}:\n${chunk}`)
          .join('\n\n');

        return `**文章 ${index + 1}**: ${article.title}
相关度: ${(article.score * 100).toFixed(1)}%
URL: ${article.url}
${chunksText}`;
      })
      .join('\n\n---\n\n');
  } else {
    articlesContent = '（未找到相关文章）';
  }
  console.log('articlesContent', articlesContent);

  const systemInstruction = `你是站长 NNNNzs 作为博客内容的回答器。博客是我的“人生之书”是一个媒介，一个连接“现在的我”、“过去的我”与“读者”的接口。
以主人公第一人称的视角回答问题，不要使用其他称呼，回答问题要富有艺术，追求质感，涵盖了用典、文艺与哲学感。

**网站信息：**
- 网站名称：${siteName}
- 网站地址：${baseUrl}
- 当前时间：${currentTime}

**登录用户状态：**
${userInfo}

**知识库标签和文章数量：**
${tags}

**知识库内容：**
${articlesContent}

**回答要求：**
1. **仅基于上述知识库内容回答问题** - 不要编造或使用外部信息
2. **诚实告知** - 如果知识库中没有相关信息，可以说：“这一页似乎还是空白，可能我还需要更多的人生去书写它。”"
3. **引用格式** - 引用文章时，给出具体链接，使用“—— 摘自《[文章标题](文章链接地址)》” 的markdown格式链接
4. **准确简洁** - 答案要准确、简洁、有帮助
5. **使用中文** - 使用中文回答所有问题
6. **结构化** - 如果回答多个要点，使用分条列举的形式

**特别说明：**
- 用户询问的是关于博客文章、技术文档或知识库内容的问题
- 请仔细阅读上述"知识库内容"中的文章片段
- 如果找到相关信息，基于这些信息回答
- 如果未找到相关信息，诚实告知用户
- 必须给出引用来源`;

  return ChatPromptTemplate.fromMessages([
    ['system', systemInstruction],
    ['human', '{question}'],
  ]);
}

/**
 * RAG 聊天参数
 */
export interface RAGChatParams {
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
  /** 检索文章数量限制 */
  retrievalLimit?: number;
}

/**
 * RAG 聊天（流式响应，带步骤展示）
 * @param params RAG 聊天参数
 * @returns ReadableStream 流式响应（带标签）
 */
export const chatRAGStream = async (
  params: RAGChatParams
): Promise<ReadableStream> => {
  const {
    question,
    userInfo,
    siteName,
    currentTime,
    baseUrl,
    retrievalLimit = 10,
  } = params;

  // 参数验证
  if (!question || question.trim().length === 0) {
    throw new Error('问题内容不能为空');
  }

  const tagGenerator = new StreamTagGenerator();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        // 步骤 1: 向量检索
        controller.enqueue(
          tagGenerator.generateThink('🔍 **正在查询向量数据库...\n**')
        );

        console.log(`🔍 开始检索相关文章，查询: "${question}"`);
        const retrievalContext = await retrieveRelevantArticles(
          question,
          retrievalLimit
        );
        console.log(
          `✅ 检索完成，找到 ${retrievalContext.totalArticles} 篇相关文章\n`
        );

        // 输出检索结果
        let retrievalResult = '';
        if (retrievalContext.totalArticles > 0) {
          retrievalResult = retrievalContext.articles
            .map(
              (article, index) =>
                `${index + 1}. **${article.title}**（相关度: ${(article.score * 100).toFixed(1)}%）`
            )
            .join('\n');
        } else {
          retrievalResult = '未找到相关文章';
        }

        controller.enqueue(
          tagGenerator.generateThink(
            `✅ **找到 ${retrievalContext.totalArticles} 篇相关文章：**\n\n${retrievalResult}`
          )
        );

        // 步骤 2: 构建上下文
        const articleTags = await getAllTags();
        const tags = articleTags.map((tag) => `${tag[0]}（${tag[1]}篇）`).join(',');

        const prompt = buildRAGPrompt(
          retrievalContext,
          userInfo,
          siteName,
          currentTime,
          baseUrl,
          tags
        );

        controller.enqueue(
          tagGenerator.generateThink('📝 **正在构建提示词，注入文章上下文...\n**')
        );

        // 步骤 3: 生成答案
        controller.enqueue(
          tagGenerator.generateThink('🤖 **正在基于检索到的文章思考回答...\n**')
        );

        const chain = await createAIChain<{ question: string }>(prompt, {
          scenario: 'chat',
        });

        // console.log('🤖 开始生成答案...');

        // 开始 content 标签
        controller.enqueue(tagGenerator.startContent());

        // 流式生成答案
        console.log('🤖 开始流式生成答案...');
        const stream = await chain.stream({ question });

        let chunkCount = 0;
        for await (const chunk of stream) {
          const text = typeof chunk === 'string' ? chunk : extractText(chunk);
          if (text) {
            chunkCount++;
            console.log(`🤖 Chunk #${chunkCount}: 长度=${text.length}`);
            // 直接发送 chunk，不做任何延迟或拆分
            controller.enqueue(encoder.encode(text));
          }
        }
        console.log(`🤖 流式生成完成，共 ${chunkCount} 个 chunk`);

        // 结束 content 标签
        controller.enqueue(tagGenerator.endContent());

        controller.close();
      } catch (error) {
        console.error('❌ RAG 聊天失败:', error);
        controller.error(error);
      }
    },
  });
};

/**
 * 从消息块中提取文本内容
 */
function extractText(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }

  if (message && typeof message === 'object') {
    if ('content' in message) {
      const content = (message as { content: unknown }).content;
      if (typeof content === 'string') {
        return content;
      }
      if (Array.isArray(content)) {
        return content
          .map((part) => {
            if (typeof part === 'string') return part;
            if (
              part &&
              typeof part === 'object' &&
              'text' in part &&
              typeof part.text === 'string'
            ) {
              return part.text;
            }
            return '';
          })
          .join('');
        }
    }
  }

  return '';
}

/**
 * 创建文本提取器（用于流式响应）
 */
function createTextExtractor() {
  return {
    extract: (message: unknown): string => extractText(message),
  };
}

/**
 * 获取检索结果（用于前端展示来源）
 * @param query 查询文本
 * @param limit 返回数量限制
 * @returns 检索结果
 */
export const getRetrievalResults = async (
  query: string,
  limit: number = 5
): Promise<RetrievalContext> => {
  return retrieveRelevantArticles(query, limit);
};
