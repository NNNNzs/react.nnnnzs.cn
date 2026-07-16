import { tool } from '@langchain/core/tools';
import type { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  listActivePromptSkills,
  loadAgentPromptSkillTemplate,
} from '@/services/ai-template';
import { AGENT_PROMPT_SKILL_POLICIES } from './prompt-skill-policy';
import type { PromptSkillAgent } from './prompt-skill-policy';
import { serializeToolData, serializeToolError } from './tool-result';

function createPromptTemplateTools(agent: PromptSkillAgent): readonly [StructuredTool, StructuredTool] {
  const policy = AGENT_PROMPT_SKILL_POLICIES[agent];

  const listPromptSkills = tool(
    async ({ query }) => {
      try {
        const record = await listActivePromptSkills(policy, query);

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
            loadTool: 'load_prompt_skill_template',
          })),
          message: `找到 ${record.length} 个可用 Skill`,
        });
      } catch (error) {
        return serializeToolError(error, '查询 Prompt Skill 失败');
      }
    },
    {
      name: 'list_prompt_skills',
      description: '列出当前 Agent 获准发现的 ACTIVE Prompt Skill metadata，不返回完整正文。',
      schema: z.object({
        query: z.string().optional().describe('Skill 名称、slug 或描述关键词'),
      }),
    },
  );

  const loadPromptSkillTemplate = tool(
    async ({ slug, version, variables }) => {
      try {
        return serializeToolData(await loadAgentPromptSkillTemplate({
          slug,
          version,
          variables,
          policy,
        }));
      } catch (error) {
        return serializeToolError(error, '加载 Prompt Skill 失败');
      }
    },
    {
      name: 'load_prompt_skill_template',
      description: '按 slug 加载当前 Agent 获准使用的 ACTIVE Prompt Skill 正文。',
      schema: z.object({
        slug: z.string().min(1).describe('Skill slug'),
        version: z.number().int().positive().optional().describe('指定 ACTIVE 版本号'),
        variables: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('可选 mustache 渲染变量'),
      }),
    },
  );

  return [listPromptSkills, loadPromptSkillTemplate];
}

export const [chatListPromptSkillsTool, chatLoadPromptSkillTemplateTool] =
  createPromptTemplateTools('chat');
export const [createListPromptSkillsTool, createLoadPromptSkillTemplateTool] =
  createPromptTemplateTools('create');
export const [topicListPromptSkillsTool, topicLoadPromptSkillTemplateTool] =
  createPromptTemplateTools('topic');
