import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PromptTemplate } from '@langchain/core/prompts';
import { getAllCollectionsSummary } from '@/services/collection';
import { getAllTags } from '@/services/tag';

const CHAT_AGENT_PROMPT_PATH = path.join(
  process.cwd(),
  'docs',
  'reference',
  'chat-agent-system-prompt.md',
);

export interface ChatAgentPromptParams {
  userInfo: string;
  siteName: string;
  currentTime: string;
  baseUrl: string;
}

async function loadPromptTemplate(): Promise<PromptTemplate> {
  const template = await readFile(CHAT_AGENT_PROMPT_PATH, 'utf8');
  return PromptTemplate.fromTemplate(template);
}

function formatKnowledgeBaseSummary(tags: Array<[string, number]>): string {
  if (tags.length === 0) return '暂无标签';

  const sortedTags = [...tags].sort((a, b) => b[1] - a[1]);
  const tagCount = tags.length;
  const totalArticles = tags.reduce((sum, [, count]) => sum + count, 0);
  const topTags = sortedTags
    .slice(0, 5)
    .map(([tag, count]) => `${tag}（${count}篇）`)
    .join('、');

  if (sortedTags.length > 5) {
    return `${topTags}等 ${tagCount} 个标签（共 ${totalArticles} 篇文章）`;
  }

  return `${topTags}（共 ${totalArticles} 篇文章）`;
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
  const [template, articleTags, collections] = await Promise.all([
    loadPromptTemplate(),
    getAllTags(),
    getAllCollectionsSummary(),
  ]);

  return template.format({
    siteName: params.siteName,
    baseUrl: params.baseUrl,
    currentTime: params.currentTime,
    userInfo: params.userInfo,
    knowledgeBaseSummary: formatKnowledgeBaseSummary(articleTags),
    collectionsSummary: formatCollectionsSummary(collections),
  });
}
