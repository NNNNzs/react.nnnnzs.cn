import { tool } from '@langchain/core/tools';
import { tavily } from '@tavily/core';
import { z } from 'zod';
import { getAIConfigValue } from '@/lib/ai-config';
import { serializeToolData, serializeToolError } from './tool-result';

async function getTavilyClient() {
  const apiKey = (await getAIConfigValue('TAVILY_API_KEY'))?.trim();
  if (!apiKey) throw new Error('TAVILY_API_KEY 未配置');
  return tavily({ apiKey });
}

export const webSearchLangChainTool = tool(
  async ({ query, searchDepth }) => {
    try {
      const client = await getTavilyClient();
      return serializeToolData(await client.search(query, {
        searchDepth: searchDepth ?? 'basic',
        maxResults: 6,
        includeRawContent: false,
      }));
    } catch (error) {
      return serializeToolError(error, '网页搜索失败');
    }
  },
  {
    name: 'web_search',
    description: '搜索最新或外部网页资料，返回标题、URL 和摘要。',
    schema: z.object({
      query: z.string().min(1).describe('搜索关键词'),
      searchDepth: z.enum(['basic', 'advanced']).optional().describe('搜索深度，默认 basic'),
    }),
  },
);

export const readSourceUrlLangChainTool = tool(
  async ({ url }) => {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return serializeToolData({ error: '只支持 HTTP/HTTPS 来源' });
      }

      const client = await getTavilyClient();
      const result = await client.extract([parsed.toString()], {
        extractDepth: 'advanced',
        format: 'markdown',
        timeout: 20,
      });
      return serializeToolData({
        ...result,
        results: result.results.map((item) => ({
          ...item,
          rawContent: item.rawContent.length > 20_000
            ? `${item.rawContent.slice(0, 20_000)}\n\n[来源正文已截断]`
            : item.rawContent,
        })),
      });
    } catch (error) {
      return serializeToolError(error, '读取来源失败');
    }
  },
  {
    name: 'read_source_url',
    description: '提取指定 HTTP/HTTPS 网页的 Markdown 正文，最多保留 20000 字符。',
    schema: z.object({
      url: z.string().url().describe('需要读取的 HTTP/HTTPS URL'),
    }),
  },
);
