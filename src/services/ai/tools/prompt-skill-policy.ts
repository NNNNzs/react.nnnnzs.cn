import type { PromptSkillAccessPolicy } from '@/services/ai-template';

export const AGENT_PROMPT_SKILL_POLICIES = {
  chat: {
    allowedScopes: ['system', 'chat'],
  },
  create: {
    allowedScopes: ['system', 'content', 'create_agent'],
  },
  topic: {
    allowedScopes: ['system', 'content', 'topic_agent'],
  },
} as const satisfies Record<string, PromptSkillAccessPolicy>;

export type PromptSkillAgent = keyof typeof AGENT_PROMPT_SKILL_POLICIES;
