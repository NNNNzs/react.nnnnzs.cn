/**
 * OpenAI LangChain 服务抽象层
 * 使用 LangChain.js 规范，仅支持 OpenAI
 * Anthropic 请使用 @/services/ai/anthropic
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { Runnable } from '@langchain/core/runnables';
import { RunnableLambda } from '@langchain/core/runnables';

// 导出 LangChain 核心类型和工具，方便其他模块使用
export { ChatPromptTemplate } from '@langchain/core/prompts';
export { StringOutputParser } from '@langchain/core/output_parsers';

/**
 * OpenAI 模型配置接口
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
  model: process.env.SILICONFLOW_FREE_QWEN,
  temperature: 0.7,
  maxTokens: 2000,
};

export const createOpenAIModel = (config: AIModelConfig = {}): ChatOpenAI => {
  const mergedConfig = { ...DEFAULT_MODEL_CONFIG, ...config };
  return new ChatOpenAI({
    apiKey: process.env.SILICONFLOW_API_KEY,
    configuration: {
      baseURL: process.env.SILICONFLOW_BASE_URL,
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
        let chunkCount = 0;
        console.log('🔄 LangChain 流式响应开始读取...');
        
        while (true) {
          const { done, value } = await iterator.next();
          
          if (done) {
            console.log(`✅ LangChain 流式响应完成，共处理 ${chunkCount} 个数据块`);
            controller.close();
            break;
          }
          
          if (value) {
            chunkCount++;
            const encoded = encoder.encode(value);
            controller.enqueue(encoded);
            
            // 前几个块输出日志
            if (chunkCount <= 3 || chunkCount % 20 === 0) {
              console.log(`📤 LangChain 第 ${chunkCount} 个数据块，长度: ${value.length}，内容预览: ${value.substring(0, 50)}...`);
            }
          } else {
            console.warn(`⚠️ LangChain 第 ${chunkCount + 1} 次读取到空值`);
          }
        }
      } catch (error) {
        console.error('❌ LangChain 流式响应错误:', error);
        if (error instanceof Error) {
          console.error('错误堆栈:', error.stack);
        }
        const errorMessage = error instanceof Error ? error.message : 'AI处理失败';
        controller.error(new Error(errorMessage));
      }
    },
    cancel() {
      console.log('⚠️ LangChain 流式响应被取消');
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
 * 从消息块中提取文本内容
 * 处理 LangChain 的消息对象，提取文本内容，忽略元数据
 */
const extractTextFromMessage = (message: unknown): string => {
  if (typeof message === 'string') {
    return message;
  }
  
  if (message && typeof message === 'object') {
    // 处理 LangChain 的消息块格式
    // AIMessageChunk 或类似对象
    if ('content' in message) {
      const content = message.content;
      if (typeof content === 'string') {
        return content;
      }
      // 如果 content 是数组（多部分消息），提取文本部分
      if (Array.isArray(content)) {
        return content
          .map((part) => {
            if (typeof part === 'string') return part;
            if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
              return part.text;
            }
            return '';
          })
          .join('');
      }
    }
    
    // 处理 lc_kwargs 格式（LangChain 内部格式）
    if ('lc_kwargs' in message && typeof message.lc_kwargs === 'object') {
      const kwargs = message.lc_kwargs as Record<string, unknown>;
      if (kwargs.content) {
        if (typeof kwargs.content === 'string') {
          return kwargs.content;
        }
        if (Array.isArray(kwargs.content)) {
          return kwargs.content
            .map((part) => {
              if (typeof part === 'string') return part;
              if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
                return part.text;
              }
              return '';
            })
            .join('');
        }
      }
    }
  }
  
  return '';
};

/**
 * 创建文本提取器（用于流式响应）
 * 从模型的消息块中提取文本，忽略元数据
 */
const createTextExtractor = () => {
  return new RunnableLambda({
    func: async (input: unknown) => {
      return extractTextFromMessage(input);
    },
  });
};

/**
 * 创建 OpenAI AI 处理链
 * 使用 LCEL 规范：prompt.pipe(model).pipe(textExtractor)
 * 注意：不使用 StringOutputParser，因为它无法处理包含元数据的流式响应
 * 注意：Anthropic 请使用 @/services/ai/anthropic
 * @param prompt ChatPromptTemplate 提示词模板
 * @param config 模型配置
 * @returns Runnable 链
 */
export function createAIChain<T extends Record<string, unknown>>(
  prompt: ChatPromptTemplate,
  config: AIModelConfig = {}
): Runnable<T, string> {
  const model = createOpenAIModel(config);
  const textExtractor = createTextExtractor();
  // 使用自定义的文本提取器，而不是 StringOutputParser
  // 这样可以正确处理包含元数据的流式响应
  return prompt.pipe(model).pipe(textExtractor) as Runnable<T, string>;
}