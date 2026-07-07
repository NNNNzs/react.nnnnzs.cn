/**
 * 创作助手 System Prompt 构建
 *
 * 与 chat-agent 的区别：prompt 模板不在文件系统，而在 content_templates 表
 * （scenario = 'content_agent', status = 'ACTIVE'），便于在线编辑。
 */

import { PromptTemplate } from '@langchain/core/prompts';
import { listContentTemplates } from '@/services/content-creation';

export interface CreateAgentPromptParams {
  /** 当前草稿标题（占位符） */
  draftTitle: string;
  /** 当前草稿类型 */
  draftType: string;
}

const FALLBACK_SYSTEM_PROMPT = `你是内容创作中台的创作助手。当前草稿标题：{draftTitle}，类型：{draftType}。
修改草稿必须调用 emit_draft_patch 工具提交结构化 patch。文生图先 generate_image 再 poll_image_job，拿到 URL 后通过 emit_draft_patch 的 addImages 回填。回答简洁，多用工具。`;

/**
 * 加载 content_agent scenario 的 system prompt 模板并填充草稿上下文。
 * 模板缺失时回退到内置默认 prompt，保证 agent 可用。
 */
export async function buildCreateAgentSystemPrompt(
  params: CreateAgentPromptParams,
): Promise<string> {
  const template = await loadSystemPromptTemplate();
  return template.format({
    draftTitle: params.draftTitle || '（未命名草稿）',
    draftType: params.draftType || 'note',
  });
}

async function loadSystemPromptTemplate(): Promise<PromptTemplate> {
  try {
    const { record } = await listContentTemplates({
      scenario: 'content_agent',
      status: 'ACTIVE',
      pageNum: 1,
      pageSize: 1,
    });

    if (record.length > 0 && record[0].content?.trim()) {
      return PromptTemplate.fromTemplate(record[0].content);
    }
  } catch (error) {
    console.warn('[create-agent] 加载 content_agent 模板失败，使用默认 prompt:', error);
  }

  return PromptTemplate.fromTemplate(FALLBACK_SYSTEM_PROMPT);
}
