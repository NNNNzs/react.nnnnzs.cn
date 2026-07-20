import type { StructuredTool } from '@langchain/core/tools';
import {
  getPostContentLangChainTool,
  searchPostsLangChainTool,
} from '../article-tools';
import {
  topicListPromptsTool,
  topicLoadPromptTemplateTool,
} from '../prompt-template-tools';
import { assembleAgentTools } from '../tool-assembly';
import {
  readSourceUrlLangChainTool,
  webSearchLangChainTool,
} from '../web-tools';
import {
  createEmitTopicPatchTool,
  createGetCurrentTopicTool,
  createSearchTopicsTool,
} from './agent-tools';
import type { TopicPatch } from '../../topic-agent/topic-patch';

export interface BuildTopicToolsParams {
  topicId?: number;
  actorUserId: number;
  scopeUserId?: number;
  emitPatch: (patch: TopicPatch) => void;
}

export function buildTopicTools(params: BuildTopicToolsParams): StructuredTool[] {
  const readTools: StructuredTool[] = [
    createSearchTopicsTool({ scopeUserId: params.scopeUserId }),
  ];
  if (params.topicId) {
    readTools.push(createGetCurrentTopicTool({
      topicId: params.topicId,
      actorUserId: params.actorUserId,
      scopeUserId: params.scopeUserId,
    }));
  }
  const emitPatchTool = createEmitTopicPatchTool({
    topicId: params.topicId,
    actorUserId: params.actorUserId,
    emitPatch: params.emitPatch,
  });

  return assembleAgentTools(
    [topicListPromptsTool, topicLoadPromptTemplateTool],
    [
      ...readTools,
      searchPostsLangChainTool,
      getPostContentLangChainTool,
      webSearchLangChainTool,
      readSourceUrlLangChainTool,
      emitPatchTool,
    ],
  );
}
