import { getAllCollectionsSummary } from '@/services/collection';
import { getPublicPostCount } from '@/services/post';
import { getAllTags } from '@/services/tag';
import { parseSiteStyleVariant } from '@/lib/site-style/variant';
import type { SiteStyleVariant } from '@/lib/site-style/variant';
import {
  compilePromptTemplate,
  createMustachePromptTemplate,
  loadPromptSkillTemplate,
} from '@/services/ai-template';
import { AGENT_PROMPT_SKILL_POLICIES } from '@/services/ai/tools/prompt-skill-policy';
import { normalizeLegacyAgentToolNames } from '@/services/ai/tools/tool-assembly';

const CHAT_AGENT_TEMPLATE_SLUGS: Record<SiteStyleVariant, string> = {
  day: 'chat-agent-day',
  night: 'chat-agent-night',
};

export interface ChatAgentPromptParams {
  userInfo: string;
  siteName: string;
  currentTime: string;
  baseUrl: string;
  styleVariant?: SiteStyleVariant;
}

type PromptContext = {
  articleTags: Array<[string, number]>;
  articleCount: number;
  collections: Awaited<ReturnType<typeof getAllCollectionsSummary>>;
};

const PROMPT_CONTEXT_CACHE_TTL_MS = 5 * 60 * 1000;
let promptContextCache: { value: PromptContext; expiresAt: number } | null = null;

async function loadPromptTemplate(styleVariant: SiteStyleVariant) {
  const template = await loadPromptSkillTemplate({
    slug: CHAT_AGENT_TEMPLATE_SLUGS[styleVariant],
  });
  if (!template.version.content.trim()) throw new Error('聊天助手系统模板为空');
  return template.version.content;
}

async function getPromptContext(): Promise<PromptContext> {
  if (promptContextCache && promptContextCache.expiresAt > Date.now()) {
    return promptContextCache.value;
  }

  const [articleTags, articleCount, collections] = await Promise.all([
    getAllTags(),
    getPublicPostCount(),
    getAllCollectionsSummary(),
  ]);

  const value = { articleTags, articleCount, collections };
  promptContextCache = {
    value,
    expiresAt: Date.now() + PROMPT_CONTEXT_CACHE_TTL_MS,
  };

  return value;
}

function formatKnowledgeBaseSummary(tags: Array<[string, number]>, articleCount: number): string {
  if (articleCount === 0) return '暂无公开文章';
  if (tags.length === 0) return `共 ${articleCount} 篇公开文章，暂无标签`;

  const sortedTags = [...tags].sort((a, b) => b[1] - a[1]);
  const tagCount = tags.length;
  const topTags = sortedTags
    .slice(0, 5)
    .map(([tag, count]) => `${tag}（${count}篇）`)
    .join('、');

  if (sortedTags.length > 5) {
    return `共 ${articleCount} 篇公开文章，${tagCount} 个标签；热门标签：${topTags}等`;
  }

  return `共 ${articleCount} 篇公开文章，${tagCount} 个标签；标签：${topTags}`;
}

function formatCollectionsSummary(
  collections: Awaited<ReturnType<typeof getAllCollectionsSummary>>,
): string {
  if (collections.length === 0) return '暂无合集';

  const collectionList = collections
    .slice(0, 10)
    .map((col) => {
      const desc = col.description ? ` - ${col.description}` : '';
      return `• 《${col.title}》（${col.articleCount} 篇）${desc}`;
    })
    .join('\n');

  if (collections.length > 10) {
    return `${collectionList}\n... 等共 ${collections.length} 个合集`;
  }

  return collectionList;
}

export async function buildChatAgentSystemPrompt(
  params: ChatAgentPromptParams,
): Promise<string> {
  const styleVariant = parseSiteStyleVariant(params.styleVariant);
  const [rawTemplate, context] = await Promise.all([
    loadPromptTemplate(styleVariant),
    getPromptContext(),
  ]);
  const compiled = await compilePromptTemplate(
    normalizeLegacyAgentToolNames(rawTemplate),
    AGENT_PROMPT_SKILL_POLICIES.chat,
  );
  const template = createMustachePromptTemplate(compiled.content);

  return template.format({
    siteName: params.siteName,
    baseUrl: params.baseUrl,
    currentTime: params.currentTime,
    userInfo: params.userInfo,
    knowledgeBaseSummary: formatKnowledgeBaseSummary(context.articleTags, context.articleCount),
    collectionsSummary: formatCollectionsSummary(context.collections),
  });
}
