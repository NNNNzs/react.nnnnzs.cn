/**
 * 文章描述生成服务
 * 使用 OpenAI + LangChain，从数据库读取配置
 */

import { ChatPromptTemplate, createAIChain, streamFromChain } from '@/lib/ai';
import { loadActivePrompt } from '@/services/ai-template';

const ARTICLE_DESCRIPTION_PROMPT_SLUG = 'blog-post-description';

async function loadArticleDescriptionPrompt() {
  const result = await loadActivePrompt({
    slug: ARTICLE_DESCRIPTION_PROMPT_SLUG,
    policy: {
      allowedScopes: ['content'],
      allowedSlugs: [ARTICLE_DESCRIPTION_PROMPT_SLUG],
    },
  });

  if (!result.version.content.trim()) {
    throw new Error('文章导语 Prompt 模板为空');
  }

  return result.version.content;
}

/**
 * 生成文章描述（流式）
 * @param content 文章内容
 * @returns ReadableStream 流式响应
 */
export const generDescriptionStream = async (
  content: string
): Promise<ReadableStream> => {
  const systemInstruction = await loadArticleDescriptionPrompt();

  // 用户录入的 ACTIVE Prompt 作为 system message，文章正文作为唯一运行上下文。
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemInstruction],
    ['human', '{content}'],
  ]);
  
  // 创建带文本提取器的链（从数据库读取 description.* 配置）
  const chain = await createAIChain<{ content: string }>(prompt, {
    scenario: 'description',
  });

  // 流式执行，输出纯文本字符串
  return streamFromChain(chain, { content });
};
