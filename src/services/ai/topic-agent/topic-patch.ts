export const TOPIC_SOURCE_TYPES = ['idea', 'blog', 'url', 'website'] as const;
export const TOPIC_STATUSES = ['IDEA', 'USED', 'ARCHIVED'] as const;

export interface TopicPatch {
  title?: string;
  sourceType?: typeof TOPIC_SOURCE_TYPES[number];
  sourceUrl?: string | null;
  sourcePostId?: number | null;
  originalIdea?: string | null;
  coreAngle?: string | null;
  keyPoints?: string[] | null;
  status?: typeof TOPIC_STATUSES[number];
}
