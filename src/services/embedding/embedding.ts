/**
 * 向量嵌入服务
 * 使用 LangChain OpenAI SDK 调用嵌入模型 API
 * 从数据库读取配置
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import { getAIConfig } from '@/lib/ai-config';

/**
 * 获取嵌入模型实例
 */
async function getEmbeddingModel(): Promise<OpenAIEmbeddings> {
  // 从数据库读取配置（如果配置缺失会直接抛错）
  const config = await getAIConfig('embedding');

  // 验证 API key 格式（SiliconFlow API key 通常以 sk- 开头）
  if (!config.api_key.startsWith('sk-')) {
    console.warn('⚠️ API key 格式可能不正确，SiliconFlow API key 通常以 "sk-" 开头');
  }

  return new OpenAIEmbeddings({
    apiKey: config.api_key,
    openAIApiKey: config.api_key, // 同时设置两个参数以确保兼容性
    model: config.model,
    configuration: {
      baseURL: config.base_url,
    },
    // 使用配置中的维度，默认 1024
    dimensions: config.dimensions || 1024,
  });
}

/**
 * 生成单个文本的向量嵌入
 * 
 * @param text 要嵌入的文本
 * @returns 向量数组（1024 维）
 */
export async function embedText(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('文本不能为空');
  }

  const embeddings = await getEmbeddingModel();
  const vector = await embeddings.embedQuery(text);

  return vector;
}

/**
 * 批量生成多个文本的向量嵌入
 * 自动分批处理，避免请求体过大（413 错误）
 * 
 * @param texts 要嵌入的文本数组
 * @param batchSize 每批处理的文本数量（默认 50，避免 413 错误）
 * @returns 向量数组（每个文本对应一个 1024 维向量）
 */
export async function embedTexts(
  texts: string[],
  batchSize: number = 50
): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  // 过滤空文本
  const validTexts = texts.filter((text) => text && text.trim().length > 0);
  if (validTexts.length === 0) {
    return [];
  }

  // 如果文本数量小于批次大小，直接处理
  if (validTexts.length <= batchSize) {
    const embeddings = await getEmbeddingModel();
    const vectors = await embeddings.embedDocuments(validTexts);
    return vectors;
  }

  // 分批处理
  const embeddings = await getEmbeddingModel();
  const allVectors: number[][] = [];

  for (let i = 0; i < validTexts.length; i += batchSize) {
    const batch = validTexts.slice(i, i + batchSize);

    try {
      const vectors = await embeddings.embedDocuments(batch);
      allVectors.push(...vectors);
    } catch (error) {
      // 如果遇到 413 错误，减小批次大小重试
      if (
        error instanceof Error &&
        (error.message.includes('413') ||
          error.message.includes('Request Entity Too Large') ||
          (error as { status?: number }).status === 413)
      ) {
        console.warn(
          `⚠️ 遇到 413 错误，减小批次大小从 ${batchSize} 到 ${Math.max(10, Math.floor(batchSize / 2))} 重试`
        );
        // 递归调用，使用更小的批次大小
        const smallerBatchSize = Math.max(10, Math.floor(batchSize / 2));
        const retryVectors = await embedTexts(batch, smallerBatchSize);
        allVectors.push(...retryVectors);
      } else {
        throw error;
      }
    }
  }

  return allVectors;
}
