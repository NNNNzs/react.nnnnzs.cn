/**
 * 聊天会话标题生成
 * 在第一轮对话结束后，根据用户问题和 assistant 回复总结一个短标题。
 */

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createOpenAIModel } from '@/lib/ai';

const TITLE_TIMEOUT_MS = 8_000;
const MAX_SOURCE_LENGTH = 1_800;
const MAX_TITLE_LENGTH = 24;

function truncateText(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function extractMessageContent(message: unknown): string {
  if (!message || typeof message !== 'object' || !('content' in message)) {
    return '';
  }

  const content = message.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

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

function normalizeTitle(title: string): string {
  return title
    .replace(/^["'“”‘’《》【】\s]+|["'“”‘’《》【】\s]+$/g, '')
    .replace(/^(标题|主题|会话标题|总结)[:：]\s*/i, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[。！？.!?]+$/g, '')
    .trim()
    .slice(0, MAX_TITLE_LENGTH);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`生成会话标题超时（${timeoutMs / 1000} 秒）`)), timeoutMs);
    }),
  ]);
}

export async function generateChatSessionTitle(params: {
  userMessage: string;
  assistantMessage: string;
}): Promise<string | null> {
  const userMessage = truncateText(params.userMessage.trim(), 600);
  const assistantMessage = truncateText(params.assistantMessage.trim(), MAX_SOURCE_LENGTH);

  if (!userMessage || !assistantMessage) return null;

  const model = await createOpenAIModel({
    scenario: 'chat',
    temperature: 0.2,
    maxTokens: 32,
  });

  const response = await withTimeout(
    model.invoke([
      new SystemMessage(
        [
          '你是会话标题生成器。',
          '根据首轮用户问题和 assistant 回复，总结一个中文会话标题。',
          `要求：${MAX_TITLE_LENGTH} 字以内，不要引号，不要句号，不要解释，只输出标题。`,
        ].join('\n'),
      ),
      new HumanMessage(
        [
          `用户问题：${userMessage}`,
          '',
          `assistant 回复：${assistantMessage}`,
        ].join('\n'),
      ),
    ]),
    TITLE_TIMEOUT_MS,
  );

  const title = normalizeTitle(extractMessageContent(response));
  return title || null;
}
