import type { StructuredTool } from '@langchain/core/tools';
import {
  getPostContentLangChainTool,
  searchPostsLangChainTool,
} from '../article-tools';
import {
  createListPromptSkillsTool,
  createLoadPromptSkillTemplateTool,
} from '../prompt-template-tools';
import { assembleAgentTools } from '../tool-assembly';
import { webSearchLangChainTool } from '../web-tools';
import {
  createEmitDraftPatchTool,
  createGetCurrentDraftTool,
} from './agent-tools';
import type { DraftPatch } from './draft-patch';

export interface BuildCreateToolsParams {
  draftId: number;
  actorUserId: number;
  emitPatch: (patch: DraftPatch) => void;
}

export function buildCreateTools(params: BuildCreateToolsParams): StructuredTool[] {
  const context = {
    draftId: params.draftId,
    actorUserId: params.actorUserId,
  };

  return assembleAgentTools(
    [createListPromptSkillsTool, createLoadPromptSkillTemplateTool],
    [
      createGetCurrentDraftTool(context),
      searchPostsLangChainTool,
      getPostContentLangChainTool,
      webSearchLangChainTool,
      createEmitDraftPatchTool({ ...context, emitPatch: params.emitPatch }),
    ],
  );
}
