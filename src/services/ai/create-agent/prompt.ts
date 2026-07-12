/**
 * 创作助手 System Prompt 构建
 *
 * 与 chat-agent 的区别：prompt 模板来自系统级 AI Template Registry。
 * 模板变量统一使用 LangChain mustache，即 {{draftTitle}}。
 */

import {
  createMustachePromptTemplate,
  loadPromptSkillTemplate,
} from '@/services/ai-template';

export interface CreateAgentPromptParams {
  /** 当前草稿标题（占位符） */
  draftTitle: string;
  /** 当前草稿类型 */
  draftType: string;
  /** 本轮草稿上下文来源 */
  contextSource: 'page' | 'database';
  /** 当前选题与草稿的只读运行上下文 */
  runtimeContext: string;
}

/**
 * 加载 content_agent scenario 的 system prompt 模板并填充草稿上下文。
 * 模板缺失时回退到内置默认 prompt，保证 agent 可用。
 */
export async function buildCreateAgentSystemPrompt(
  params: CreateAgentPromptParams,
): Promise<string> {
  const rawTemplate = await loadSystemPromptTemplate();
  const template = createMustachePromptTemplate(rawTemplate);
  return template.format({
    draftTitle: params.draftTitle || '（未命名草稿）',
    draftType: params.draftType || 'note',
    contextSource: params.contextSource === 'page' ? '页面实时上下文' : '数据库草稿上下文',
    runtimeContext: params.runtimeContext,
  });
}

async function loadSystemPromptTemplate(): Promise<string> {
  const result = await loadPromptSkillTemplate({
    slug: 'agent-create-agent-system',
  });
  if (!result.version.content.trim()) throw new Error('创作助手系统模板为空');
  return result.version.content;
}
