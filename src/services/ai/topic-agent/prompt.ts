import {
  compilePromptTemplate,
  createMustachePromptTemplate,
  loadPromptSkillTemplate,
} from '@/services/ai-template';

export interface TopicAgentPromptParams {
  topicTitle?: string | null;
  mode: 'create' | 'edit';
  runtimeContext: string;
}

export async function buildTopicAgentSystemPrompt(
  params: TopicAgentPromptParams,
): Promise<string> {
  const rawTemplate = await loadSystemPromptTemplate();
  const template = createMustachePromptTemplate(rawTemplate);
  const rendered = await template.format({
    mode: params.mode === 'edit' ? '完善已有选题' : '整理新选题',
    topicTitle: params.topicTitle?.trim() || '（尚未创建）',
    contextSource: '数据库选题上下文',
    runtimeContext: params.runtimeContext,
  });
  const compiled = await compilePromptTemplate(rendered);
  return compiled.content;
}

async function loadSystemPromptTemplate(): Promise<string> {
  const result = await loadPromptSkillTemplate({
    slug: 'agent-topic-agent-system',
  });
  if (!result.version.content.trim()) throw new Error('选题助手系统模板为空');
  return result.version.content;
}
