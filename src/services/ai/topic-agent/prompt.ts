import {
  compilePromptTemplate,
  createMustachePromptTemplate,
  loadPromptSkillTemplate,
} from '@/services/ai-template';
import { AGENT_PROMPT_SKILL_POLICIES } from '@/services/ai/tools/prompt-skill-policy';
import { normalizeLegacyAgentToolNames } from '@/services/ai/tools/tool-assembly';

export interface TopicAgentPromptParams {
  topicTitle?: string | null;
  mode: 'create' | 'edit';
  runtimeContext: string;
}

export async function buildTopicAgentSystemPrompt(
  params: TopicAgentPromptParams,
): Promise<string> {
  const rawTemplate = normalizeLegacyAgentToolNames(await loadSystemPromptTemplate());
  const compiled = await compilePromptTemplate(
    rawTemplate,
    AGENT_PROMPT_SKILL_POLICIES.topic,
  );
  const template = createMustachePromptTemplate(compiled.content);
  return template.format({
    mode: params.mode === 'edit' ? '完善已有选题' : '整理新选题',
    topicTitle: params.topicTitle?.trim() || '（尚未创建）',
    contextSource: '数据库选题上下文',
    runtimeContext: params.runtimeContext,
  });
}

async function loadSystemPromptTemplate(): Promise<string> {
  const result = await loadPromptSkillTemplate({
    slug: 'agent-topic-agent-system',
  });
  if (!result.version.content.trim()) throw new Error('选题助手系统模板为空');
  return result.version.content;
}
