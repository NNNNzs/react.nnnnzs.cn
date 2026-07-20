import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  AI_TEMPLATE_SCOPES,
  listActivePrompts,
  loadActivePrompt,
} from '@/services/ai-template';
import type { PromptAccessPolicy } from '@/services/ai-template';

const MCP_PROMPT_POLICY = {
  allowedScopes: AI_TEMPLATE_SCOPES,
} as const satisfies PromptAccessPolicy;

type EnsureAuth = () => Promise<unknown>;

function isMcpExposed(metadata: unknown) {
  return typeof metadata === 'object'
    && metadata !== null
    && !Array.isArray(metadata)
    && 'mcpExposed' in metadata
    && metadata.mcpExposed === true;
}

function getPromptDescription(prompt: {
  description: string | null;
  slug: string;
}) {
  return prompt.description
    || `Prompt @${prompt.slug} 的当前激活版本。`;
}

export async function registerMcpPrompts(
  server: McpServer,
  ensureAuth: EnsureAuth,
) {
  await ensureAuth();
  const prompts = await listActivePrompts(MCP_PROMPT_POLICY);

  for (const prompt of prompts) {
    if (!isMcpExposed(prompt.metadata_json)) continue;

    server.registerPrompt(
      prompt.slug,
      {
        title: prompt.name,
        description: getPromptDescription(prompt),
      },
      async () => {
        await ensureAuth();
        const loaded = await loadActivePrompt({
          slug: prompt.slug,
          policy: MCP_PROMPT_POLICY,
        });

        return {
          description: getPromptDescription(loaded.template),
          messages: [{
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: loaded.version.content,
            },
          }],
        };
      },
    );
  }
}
