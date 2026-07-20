import type { PromptAccessPolicy } from '@/services/ai-template';

export const AGENT_PROMPT_POLICIES = {
  chat: {
    allowedScopes: ['system', 'chat'],
  },
  create: {
    allowedScopes: ['system', 'content', 'create_agent'],
  },
  topic: {
    allowedScopes: ['system', 'content', 'topic_agent'],
  },
} as const satisfies Record<string, PromptAccessPolicy>;

export type PromptAgent = keyof typeof AGENT_PROMPT_POLICIES;
