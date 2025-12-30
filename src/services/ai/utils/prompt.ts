/**
 * AI 提示词工具函数
 * 提供通用的提示词模板创建功能
 */

import { ChatPromptTemplate } from '@/lib/ai';

/**
 * 创建带有系统指令和用户输入的基础提示词模板
 * 注意：Anthropic API 只允许一条 system 消息在开头
 * @param systemInstruction 系统指令
 * @param userTemplate 用户输入模板
 * @returns ChatPromptTemplate
 */
export const createBasePrompt = (
  systemInstruction: string,
  userTemplate: string
): ChatPromptTemplate => {
  return ChatPromptTemplate.fromMessages([
    ['system', systemInstruction],
    ['human', userTemplate],
  ]);
};

/**
 * 创建带上下文信息的提示词模板
 * @param systemInstruction 系统指令
 * @param contextPlaceholder 上下文占位符（如 '{context}'）
 * @param userPlaceholder 用户输入占位符（如 '{text}'）
 * @returns ChatPromptTemplate
 */
export const createPromptWithContext = (
  systemInstruction: string,
  contextPlaceholder: string,
  userPlaceholder: string
): ChatPromptTemplate => {
  return ChatPromptTemplate.fromMessages([
    ['system', systemInstruction],
    ['human', `上下文信息：${contextPlaceholder}\n\n需要处理的文本：${userPlaceholder}`],
  ]);
};

/**
 * 创建带中文提示的系统指令
 * @param instruction 具体指令内容
 * @returns 完整的系统指令字符串
 */
export const createChineseSystemInstruction = (instruction: string): string => {
  return `请使用中文回复。\n\n${instruction}`;
};
