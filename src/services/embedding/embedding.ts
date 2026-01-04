/**
 * 向量嵌入服务
 * 使用 LangChain OpenAI SDK 调用嵌入模型 API
 */

import { OpenAIEmbeddings } from '@langchain/openai';

/**
 * 获取嵌入模型实例
 */
function getEmbeddingModel(): OpenAIEmbeddings {
  const apiKey = process.env.BLOG_EMBEDDING_API_KEY;
  const baseURL = process.env.BLOG_EMBEDDING_BASE_URL;
  const model = process.env.BLOG_EMBEDDING_MODEL || 'BAAI/bge-large-zh-v1.5';

  if (!apiKey) {
    throw new Error('BLOG_EMBEDDING_API_KEY 环境变量未设置');
  }

  if (!baseURL) {
    throw new Error('BLOG_EMBEDDING_BASE_URL 环境变量未设置');
  }

  // 验证 API key 格式（SiliconFlow API key 通常以 sk- 开头）
  if (!apiKey.startsWith('sk-')) {
    console.warn('⚠️ API key 格式可能不正确，SiliconFlow API key 通常以 "sk-" 开头');
  }

  console.log(`🔑 使用嵌入模型: ${model}, BaseURL: ${baseURL}, API Key: ${apiKey.substring(0, 10)}...`);

  return new OpenAIEmbeddings({
    apiKey: apiKey,
    openAIApiKey: apiKey, // 同时设置两个参数以确保兼容性
    model: model,
    configuration: {
      baseURL: baseURL,
    },
    // BAAI/bge-large-zh-v1.5 的维度是 1024
    dimensions: 1024,
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

  const embeddings = getEmbeddingModel();
  const vector = await embeddings.embedQuery(text);

  return vector;
}

/**
 * 批量生成多个文本的向量嵌入
 * 
 * @param texts 要嵌入的文本数组
 * @returns 向量数组（每个文本对应一个 1024 维向量）
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  // 过滤空文本
  const validTexts = texts.filter((text) => text && text.trim().length > 0);
  if (validTexts.length === 0) {
    return [];
  }

  const embeddings = getEmbeddingModel();
  const vectors = await embeddings.embedDocuments(validTexts);

  return vectors;
}
