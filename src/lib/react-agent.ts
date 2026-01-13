/**
 * ReAct Agent 实现
 * 使用 Thought-Action-Observation 循环
 * 手写 tool call 解析（因为模型不支持原生 function calling）
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { 
  parseToolCalls, 
  executeToolCall, 
  formatJsonRpcResponse,
  type JsonRpcResponse
} from '@/services/ai/tools';

/**
 * ReAct Agent 配置
 */
export interface ReactAgentConfig {
  /** 模型实例 */
  model: ChatOpenAI;
  /** 系统提示词 */
  systemPrompt: string;
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 是否启用详细日志 */
  verbose?: boolean;
}

/**
 * SSE 事件类型
 */
export type SSEEventType = 
  | 'thought'        // 思考过程
  | 'action'         // 工具调用
  | 'observation'    // 工具结果
  | 'answer'         // 最终答案
  | 'error'          // 错误信息
  | 'done';          // 完成标记

/**
 * SSE 事件数据
 */
export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
}

/**
 * 历史消息
 */
export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * ReAct Agent 运行参数
 */
export interface ReactAgentRunParams {
  /** 用户输入 */
  input: string;
  /** 历史对话 */
  history?: HistoryMessage[];
  /** 流式事件回调 */
  onEvent?: (event: SSEEvent) => void | Promise<void>;
}

/**
 * 创建 ReAct Agent
 */
export class ReactAgent {
  private model: ChatOpenAI;
  private systemPrompt: string;
  private maxIterations: number;
  private verbose: boolean;

  constructor(config: ReactAgentConfig) {
    this.model = config.model;
    this.systemPrompt = config.systemPrompt;
    this.maxIterations = config.maxIterations || 5;
    this.verbose = config.verbose || false;
  }

  /**
   * 运行 ReAct 循环
   */
  async run(params: ReactAgentRunParams): Promise<void> {
    const { input, history = [], onEvent } = params;
    
    try {
      // 构建初始消息
      const messages: Array<SystemMessage | HumanMessage | AIMessage> = [
        new SystemMessage(this.systemPrompt),
      ];

      // 添加历史对话
      for (const h of history) {
        if (h.role === 'user') {
          messages.push(new HumanMessage(h.content));
        } else {
          messages.push(new AIMessage(h.content));
        }
      }

      // 添加用户输入
      messages.push(new HumanMessage(input));

      // ReAct 循环
      let iteration = 0;
      let shouldContinue = true;

      while (shouldContinue && iteration < this.maxIterations) {
        iteration++;
        
        if (this.verbose) {
          console.log(`\n🔄 ReAct 迭代 ${iteration}/${this.maxIterations}`);
          console.log(`📋 当前消息历史长度: ${messages.length}`);
          if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            console.log(`📋 最后一条消息类型: ${lastMsg.constructor.name}`);
            console.log(`📋 最后一条消息内容长度: ${lastMsg.content.length}`);
            console.log(`📋 最后一条消息内容预览: ${lastMsg.content.substring(0, 200)}...`);
          }
        }

        // 调用模型（直接使用消息对象，不使用模板）
        const stream = await this.model.stream(messages);
        
        let responseText = '';
        let chunkCount = 0;
        
        // 流式接收响应
        for await (const chunk of stream) {
          chunkCount++;
          const content = this.extractContent(chunk);
          if (content) {
            responseText += content;
            
            // 发送思考过程（流式）
            await onEvent?.({
              type: 'thought',
              data: content,
            });
          } else if (this.verbose && chunkCount <= 5) {
            console.log(`⚠️ 第 ${chunkCount} 个 chunk 没有提取到内容:`, chunk);
          }
        }

        if (this.verbose) {
          console.log(`💭 收到 ${chunkCount} 个 chunks`);
          console.log(`💭 模型响应长度: ${responseText.length}`);
          console.log(`💭 模型响应内容: ${responseText.substring(0, 300)}...`);
        }

        // 解析工具调用
        const toolCalls = parseToolCalls(responseText);
        
        if (toolCalls.length > 0) {
          // 有工具调用，执行 Action-Observation 循环
          if (this.verbose) {
            console.log(`🔧 检测到 ${toolCalls.length} 个工具调用`);
          }

          for (const toolCall of toolCalls) {
            // 发送 Action 事件
            await onEvent?.({
              type: 'action',
              data: {
                method: toolCall.name,
                params: toolCall.args,
                id: toolCall.id,
              },
            });

            // 执行工具
            const { result, id } = await executeToolCall(toolCall);
            
            // 格式化 JSON-RPC 响应
            const jsonRpcResponse = formatJsonRpcResponse(id, result);
            
            // 发送 Observation 事件
            await onEvent?.({
              type: 'observation',
              data: jsonRpcResponse,
            });

            // 将工具结果添加到消息历史
            // 使用更清晰的格式，帮助模型理解如何基于结果生成答案
            const toolResultData = jsonRpcResponse.result || jsonRpcResponse.error;
            const observationText = `\n\n工具执行结果（Observation）：\n${JSON.stringify(toolResultData, null, 2)}\n\n基于以上工具执行结果，请给出最终答案。`;
            responseText += observationText;
            
            if (this.verbose) {
              console.log(`📥 添加工具结果到上下文，长度: ${observationText.length}`);
            }
          }

          // 将完整的响应（包含工具结果）添加到消息历史
          // 使用 AIMessage 类，不会触发模板解析
          messages.push(new AIMessage(responseText));
          
          // 添加一个明确的提示，告诉模型需要基于工具结果生成答案
          messages.push(new HumanMessage('请基于上述工具执行结果，给出最终答案。'));
          
          if (this.verbose) {
            console.log(`📤 已添加工具结果到消息历史，准备下一轮迭代`);
            console.log(`📤 当前消息历史长度: ${messages.length}`);
          }
          
          // 继续下一轮迭代
          shouldContinue = true;
        } else {
          // 没有工具调用，说明得出了最终答案
          if (this.verbose) {
            console.log('✅ 模型给出最终答案');
          }

          // 移除响应中的工具调用相关内容（如果有）
          let cleanedResponse = this.cleanResponse(responseText);
          
          if (this.verbose) {
            console.log('📝 原始响应长度:', responseText.length);
            console.log('📝 清理后响应长度:', cleanedResponse.length);
            console.log('📝 清理后响应内容:', cleanedResponse.substring(0, 200));
          }
          
          // 如果清理后为空，尝试更宽松的清理方式
          if (!cleanedResponse.trim()) {
            // 只移除代码块标记，保留内容
            cleanedResponse = responseText
              .replace(/```json-rpc\s*/g, '')
              .replace(/```\s*/g, '')
              .trim();
            
            if (this.verbose) {
              console.log('📝 宽松清理后响应长度:', cleanedResponse.length);
            }
          }
          
          // 如果还是为空，使用原始响应（移除明显的 JSON-RPC 结构）
          if (!cleanedResponse.trim()) {
            // 尝试提取 JSON-RPC 代码块之外的内容
            const jsonRpcBlockRegex = /```json-rpc\s*[\s\S]*?```/g;
            cleanedResponse = responseText.replace(jsonRpcBlockRegex, '').trim();
            
            if (this.verbose) {
              console.warn('⚠️ 清理后的响应为空，使用原始响应（移除代码块）');
            }
          }
          
          // 发送最终答案（确保有内容）
          const finalAnswer = cleanedResponse.trim() || responseText.trim();
          if (finalAnswer) {
            await onEvent?.({
              type: 'answer',
              data: finalAnswer,
            });
          } else {
            console.error('❌ 无法提取最终答案，响应文本为空');
          }

          shouldContinue = false;
        }
      }

      // 发送完成事件
      await onEvent?.({
        type: 'done',
        data: null,
      });

      if (iteration >= this.maxIterations) {
        console.warn('⚠️ 达到最大迭代次数');
        // 如果达到最大迭代次数但没有最终答案，发送提示
        await onEvent?.({
          type: 'answer',
          data: '抱歉，处理过程超时。已达到最大迭代次数。',
        });
      }

    } catch (error) {
      console.error('❌ ReAct Agent 运行错误:', error);
      
      // 发送错误事件
      await onEvent?.({
        type: 'error',
        data: {
          message: error instanceof Error ? error.message : '未知错误',
        },
      });
      
      // 确保发送完成事件
      await onEvent?.({
        type: 'done',
        data: null,
      });
    }
  }

  /**
   * 从模型输出中提取文本内容
   */
  private extractContent(chunk: unknown): string {
    // 直接是字符串
    if (typeof chunk === 'string') {
      return chunk;
    }
    
    // 处理 LangChain 的消息块格式
    if (chunk && typeof chunk === 'object') {
      // 尝试 content 字段
      if ('content' in chunk) {
        const content = (chunk as { content: unknown }).content;
        if (typeof content === 'string') {
          return content;
        }
        // 如果 content 是数组（多部分消息）
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
      
      // 尝试 lc_kwargs 格式（LangChain 内部格式）
      if ('lc_kwargs' in chunk && typeof chunk.lc_kwargs === 'object') {
        const kwargs = chunk.lc_kwargs as Record<string, unknown>;
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
  }

  /**
   * 清理响应文本，移除工具调用代码块
   */
  private cleanResponse(text: string): string {
    // 移除 JSON-RPC 代码块
    return text.replace(/```json-rpc\s*[\s\S]*?```/g, '').trim();
  }
}

/**
 * 创建 ReAct Agent 实例
 */
export function createReactAgent(config: ReactAgentConfig): ReactAgent {
  return new ReactAgent(config);
}
