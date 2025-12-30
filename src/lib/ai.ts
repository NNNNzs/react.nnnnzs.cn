/**
 * 统一的 AI 服务抽象层
 * 使用 LangChain.js 规范，支持 Anthropic
 * 提供流式响应处理功能
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { Runnable } from '@langchain/core/runnables';

// 导出 LangChain 核心类型和工具，方便其他模块使用
export { ChatPromptTemplate } from '@langchain/core/prompts';
export { StringOutputParser } from '@langchain/core/output_parsers';
export type { ChatAnthropic } from '@langchain/anthropic';

/**
 * AI 模型配置接口
 */
export interface AIModelConfig {
  /** 模型名称 */
  model?: string;
  /** 温度参数 */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
}

/**
 * 默认模型配置
 */
const DEFAULT_MODEL_CONFIG: AIModelConfig = {
  model: 'claude-haiku-4-5-20251001',
  temperature: 0.7,
  maxTokens: 2000,
};

/**
 * 创建 Anthropic 模型实例
 * @param config 模型配置
 * @returns ChatAnthropic 实例
 */
export const createAnthropicModel = (config: AIModelConfig = {}): ChatAnthropic => {
  const mergedConfig = { ...DEFAULT_MODEL_CONFIG, ...config };

  return new ChatAnthropic({
    anthropicApiKey: process.env.ANTHROPIC_AUTH_TOKEN,
    clientOptions: {
      baseURL: process.env.ANTHROPIC_BASE_URL,
    },
    streaming: true,
    model: mergedConfig.model,
    temperature: mergedConfig.temperature,
    maxTokens: mergedConfig.maxTokens,
  });
};

export const createOpenAIModel = (config: AIModelConfig = {}): ChatOpenAI => {
  const mergedConfig = { ...DEFAULT_MODEL_CONFIG, ...config };
  return new ChatOpenAI({
    apiKey: process.env.OPENAI_AUTH_TOKEN,
    openAIApiKey: process.env.OPENAI_AUTH_TOKEN,
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL_PROXY,
    },
    streaming: true,
    model: mergedConfig.model,
    temperature: mergedConfig.temperature,
    maxTokens: mergedConfig.maxTokens,
  });
};

/**
 * 创建 StringOutputParser 实例
 * @returns StringOutputParser 实例
 */
export const createStringOutputParser = (): StringOutputParser => {
  return new StringOutputParser();
};

/**
 * 将 LangChain 流式响应转换为 ReadableStream
 * 使用 start 方法持续读取并推送数据到客户端
 * @param streamIterable LangChain 流式响应（AsyncIterable<string>）
 * @returns ReadableStream
 */
export const convertLangChainStreamToReadableStream = (
  streamIterable: AsyncIterable<string>,
): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  const iterator = streamIterable[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await iterator.next();
          
          if (done) {
            controller.close();
            break;
          }
          
          if (value) {
            controller.enqueue(encoder.encode(value));
          }
        }
      } catch (error) {
        console.error('流式响应错误:', error);
        const errorMessage = error instanceof Error ? error.message : 'AI处理失败';
        controller.error(new Error(errorMessage));
      }
    },
    cancel() {
      // 当客户端取消时清理资源
      iterator.return?.();
    },
  });
};

/**
 * 使用 LCEL 链执行流式响应
 * @param chain LangChain Runnable 链
 * @param input 输入参数
 * @returns ReadableStream
 */
export const streamFromChain = async <T extends Record<string, unknown>>(
  chain: Runnable<T, string>,
  input: T,
): Promise<ReadableStream> => {
  const stream = await chain.stream(input);
  return convertLangChainStreamToReadableStream(stream);
};

/**
 * 创建 AI 处理链
 * 使用 LCEL 规范：prompt.pipe(model).pipe(outputParser)
 * @param prompt ChatPromptTemplate 提示词模板
 * @param config 模型配置
 * @returns Runnable 链
 */
export const createAIChain = <T extends Record<string, unknown>>(
  prompt: ChatPromptTemplate,
  config: AIModelConfig = {},
  provider: 'anthropic' | 'openai' = 'anthropic'
): Runnable<T, string> => {
  const model = provider === 'anthropic' ? createAnthropicModel(config) : createOpenAIModel(config);
  const outputParser = createStringOutputParser();

  return prompt.pipe(model).pipe(outputParser) as Runnable<T, string>;
};

