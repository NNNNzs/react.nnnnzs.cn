export const AI_TEMPLATE_TYPES = ['prompt', 'skill'] as const;

export const AI_TEMPLATE_SCOPES = [
  'system',
  'chat',
  'create_agent',
  'topic_agent',
  'content',
] as const;

export const AI_TEMPLATE_STATUSES = ['ACTIVE', 'DRAFT', 'ARCHIVED'] as const;

export type AiTemplateType = typeof AI_TEMPLATE_TYPES[number];
export type AiTemplateScope = typeof AI_TEMPLATE_SCOPES[number];
export type AiTemplateStatus = typeof AI_TEMPLATE_STATUSES[number];
