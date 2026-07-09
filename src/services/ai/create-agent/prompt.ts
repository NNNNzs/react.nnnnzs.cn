/**
 * 创作助手 System Prompt 构建
 *
 * 与 chat-agent 的区别：prompt 模板来自系统级 AI Template Registry。
 * 模板变量统一使用 LangChain mustache，即 {{draftTitle}}。
 */

import {
  compilePromptTemplate,
  createMustachePromptTemplate,
  loadPromptSkillTemplate,
} from '@/services/ai-template';

export interface CreateAgentPromptParams {
  /** 当前草稿标题（占位符） */
  draftTitle: string;
  /** 当前草稿类型 */
  draftType: string;
}

const FALLBACK_SYSTEM_PROMPT = `你是内容创作中台的创作助手。当前草稿标题：{{draftTitle}}，类型：{{draftType}}。

你可以按需使用 @xhs-style-guide 的 metadata。只有当任务确实需要完整小红书风格指南时，才调用 load_prompt_skill_template 读取 slug=xhs-style-guide 的原文。

修改草稿必须调用 emit_draft_patch 工具提交结构化 patch，由前端展示差异并等待用户确认。文生图先 generate_image 再 poll_image_job，拿到 URL 后通过 emit_draft_patch 的 addImages 提交待确认图片建议。回答简洁，多用工具。`;

/**
 * 加载 content_agent scenario 的 system prompt 模板并填充草稿上下文。
 * 模板缺失时回退到内置默认 prompt，保证 agent 可用。
 */
export async function buildCreateAgentSystemPrompt(
  params: CreateAgentPromptParams,
): Promise<string> {
  const rawTemplate = await loadSystemPromptTemplate();
  const compiled = await compilePromptTemplate(rawTemplate);
  const template = createMustachePromptTemplate(compiled.content);

  return template.format({
    draftTitle: params.draftTitle || '（未命名草稿）',
    draftType: params.draftType || 'note',
  });
}

async function loadSystemPromptTemplate(): Promise<string> {
  try {
    const result = await loadPromptSkillTemplate({
      slug: 'agent-create-agent-system',
    });

    if (result.version.content?.trim()) {
      return result.version.content;
    }
  } catch (error) {
    console.warn('[create-agent] 加载系统级 content_agent 模板失败，使用默认 prompt:', error);
  }

  return FALLBACK_SYSTEM_PROMPT;
}
