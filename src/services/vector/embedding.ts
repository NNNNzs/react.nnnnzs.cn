/**
 * 向量嵌入服务
 * 使用 LangChain OpenAI SDK 调用嵌入模型
 * 从数据库读取配置
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import { getAIConfig } from '@/lib/ai-config';

/**
 * 创建嵌入模型实例
 */
export async function createEmbeddingModel(): Promise<OpenAIEmbeddings> {
  // 从数据库读取配置（如果配置缺失会直接抛错）
  const config = await getAIConfig('embedding');

  return new OpenAIEmbeddings({
    openAIApiKey: config.api_key,
    configuration: {
      baseURL: config.base_url,
    },
    model: config.model,
    // 使用配置中的维度，默认 1024
    dimensions: config.dimensions || 1024,
  });
}

/**
 * 生成文本的向量嵌入
 * @param texts 文本数组
 * @returns 向量数组
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings = await createEmbeddingModel();
  
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
  const embeddings = await createEmbeddingModel();
  
  try {
    const vector = await embeddings.embedQuery(text);
    return vector;
  } catch (error) {
    console.error('生成向量嵌入失败:', error);
    throw new Error(`生成向量嵌入失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}
