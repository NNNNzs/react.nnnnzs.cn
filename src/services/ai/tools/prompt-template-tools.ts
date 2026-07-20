import { tool } from '@langchain/core/tools';
import type { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  listActivePrompts,
  loadAgentPromptTemplate,
} from '@/services/ai-template';
import { AGENT_PROMPT_POLICIES } from './prompt-policy';
import type { PromptAgent } from './prompt-policy';
import { serializeToolData, serializeToolError } from './tool-result';

function createPromptTemplateTools(agent: PromptAgent): readonly [StructuredTool, StructuredTool] {
  const policy = AGENT_PROMPT_POLICIES[agent];

  const listPromptsTool = tool(
    async ({ query }) => {
      try {
        const record = await listActivePrompts(policy, query);

        return serializeToolData({
          templates: record.map((item) => ({
            slug: item.slug,
            key: item.key,
            name: item.name,
            type: item.type,
            scope: item.scope,
            description: item.description,
            aliases: item.aliases,
            currentVersion: item.current_version,
            metadata: item.metadata_json,
            loadTool: 'load_prompt_template',
          })),
          message: `找到 ${record.length} 个可用 Prompt`,
        });
      } catch (error) {
        return serializeToolError(error, '查询 Prompt 失败');
      }
    },
    {
      name: 'list_prompts',
      description: '列出当前 Agent 获准发现的 ACTIVE Prompt metadata，不返回完整正文。',
      schema: z.object({
        query: z.string().optional().describe('Prompt 名称、slug 或描述关键词'),
      }),
    },
  );

  const loadPromptTemplateTool = tool(
    async ({ slug, version, variables }) => {
      try {
        return serializeToolData(await loadAgentPromptTemplate({
          slug,
          version,
          variables,
          policy,
        }));
      } catch (error) {
        return serializeToolError(error, '加载 Prompt 失败');
      }
    },
    {
      name: 'load_prompt_template',
      description: '按 slug 加载当前 Agent 获准使用的 ACTIVE Prompt 正文。',
      schema: z.object({
        slug: z.string().min(1).describe('Prompt slug'),
        version: z.number().int().positive().optional().describe('指定 ACTIVE 版本号'),
        variables: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('可选 mustache 渲染变量'),
      }),
    },
  );

  return [listPromptsTool, loadPromptTemplateTool];
}

export const [chatListPromptsTool, chatLoadPromptTemplateTool] =
  createPromptTemplateTools('chat');
export const [createListPromptsTool, createLoadPromptTemplateTool] =
  createPromptTemplateTools('create');
export const [topicListPromptsTool, topicLoadPromptTemplateTool] =
  createPromptTemplateTools('topic');
