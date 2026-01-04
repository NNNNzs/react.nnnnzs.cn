/**
 * 向量嵌入服务
 * 使用 LangChain OpenAI SDK 调用嵌入模型
 */

import { OpenAIEmbeddings } from '@langchain/openai';

/**
 * 创建嵌入模型实例
 */
export function createEmbeddingModel(): OpenAIEmbeddings {
  const apiKey = process.env.BLOG_EMBEDDING_API_KEY;
  const baseURL = process.env.BLOG_EMBEDDING_BASE_URL;
  const model = process.env.BLOG_EMBEDDING_MODEL || 'BAAI/bge-large-zh-v1.5';

  if (!apiKey) {
    throw new Error('BLOG_EMBEDDING_API_KEY 环境变量未设置');
  }

  if (!baseURL) {
    throw new Error('BLOG_EMBEDDING_BASE_URL 环境变量未设置');
  }

  return new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    configuration: {
      baseURL: baseURL,
    },
    model: model,
    // BAAI/bge-large-zh-v1.5 的维度是 1024
    dimensions: 1024,
  });
}

/**
 * 生成文本的向量嵌入
 * @param texts 文本数组
 * @returns 向量数组
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings = createEmbeddingModel();
  
  try {
    const vectors = await embeddings.embedDocuments(texts);
    return vectors;
  } catch (error) {
    console.error('生成向量嵌入失败:', error);
    throw new Error(`生成向量嵌入失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 生成单个文本的向量嵌入
 * @param text 文本
 * @returns 向量
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddings = createEmbeddingModel();
  
  try {
    const vector = await embeddings.embedQuery(text);
    return vector;
  } catch (error) {
    console.error('生成向量嵌入失败:', error);
    throw new Error(`生成向量嵌入失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}
