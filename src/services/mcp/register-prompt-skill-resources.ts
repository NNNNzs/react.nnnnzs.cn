import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  AI_TEMPLATE_SCOPES,
  listActivePromptSkills,
  loadActivePromptSkill,
} from '@/services/ai-template';
import type { PromptSkillAccessPolicy } from '@/services/ai-template';

const MCP_PROMPT_SKILL_POLICY = {
  allowedScopes: AI_TEMPLATE_SCOPES,
} as const satisfies PromptSkillAccessPolicy;

type EnsureAuth = () => Promise<unknown>;

function getSkillUri(slug: string) {
  return `blog://skills/${encodeURIComponent(slug)}`;
}

function getSkillDescription(skill: {
  description: string | null;
  slug: string;
}) {
  return skill.description
    || `Prompt Skill @${skill.slug}，按需读取当前激活版本的完整正文。`;
}

async function getPromptSkillIndex() {
  const skills = await listActivePromptSkills(MCP_PROMPT_SKILL_POLICY);

  return {
    skills: skills.map((skill) => ({
      slug: skill.slug,
      name: skill.name,
      description: skill.description,
      scope: skill.scope,
      version: skill.current_version,
      uri: getSkillUri(skill.slug),
    })),
  };
}

export function registerPromptSkillResources(
  server: McpServer,
  ensureAuth: EnsureAuth,
) {
  server.registerResource(
    'prompt_skills',
    'blog://skills',
    {
      title: 'Available Prompt Skills',
      description: '所有已激活 Prompt Skill 的 metadata 索引。先读取此资源选择需要的 Skill，再按对应 URI 加载完整正文。',
      mimeType: 'application/json',
    },
    async () => {
      await ensureAuth();
      const index = await getPromptSkillIndex();

      return {
        contents: [{
          uri: 'blog://skills',
          mimeType: 'application/json',
          text: JSON.stringify(index, null, 2),
        }],
      };
    },
  );

  server.registerResource(
    'prompt_skill',
    new ResourceTemplate('blog://skills/{slug}', {
      list: async () => {
        await ensureAuth();
        const { skills } = await getPromptSkillIndex();

        return {
          resources: skills.map((skill) => ({
            uri: skill.uri,
            name: skill.slug,
            title: skill.name,
            description: skill.description
              || `Prompt Skill @${skill.slug}，按需读取当前激活版本的完整正文。`,
            mimeType: 'text/markdown',
            _meta: {
              slug: skill.slug,
              scope: skill.scope,
              version: skill.version,
            },
          })),
        };
      },
    }),
    {
      title: 'Prompt Skill',
      description: '按 slug 读取 AI Lab 中已激活 Prompt Skill 的当前版本正文。',
      mimeType: 'text/markdown',
    },
    async (uri, variables) => {
      await ensureAuth();
      const rawSlug = variables.slug;
      const encodedSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
      if (!encodedSlug) {
        throw new Error('Missing Prompt Skill slug');
      }

      const slug = decodeURIComponent(encodedSlug);
      const loaded = await loadActivePromptSkill({
        slug,
        policy: MCP_PROMPT_SKILL_POLICY,
      });

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'text/markdown',
          text: loaded.version.content,
          _meta: {
            slug: loaded.template.slug,
            name: loaded.template.name,
            description: getSkillDescription(loaded.template),
            scope: loaded.template.scope,
            version: loaded.version.version,
            checksum: loaded.version.checksum,
          },
        }],
      };
    },
  );
}
