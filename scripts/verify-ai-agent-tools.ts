import assert from 'node:assert/strict';
import type { StructuredTool } from '@langchain/core/tools';
import { chatTools } from '@/services/ai/tools/chat-tools';
import { buildCreateTools } from '@/services/ai/tools/create-tools/build-tools';
import {
  assembleAgentTools,
  normalizeLegacyAgentToolNames,
} from '@/services/ai/tools/tool-assembly';
import { buildTopicTools } from '@/services/ai/tools/topic-tools/build-tools';

function toolNames(tools: StructuredTool[]) {
  return tools.map((currentTool) => currentTool.name);
}

function findTool(tools: StructuredTool[], name: string) {
  const currentTool = tools.find((item) => item.name === name);
  assert.ok(currentTool, `缺少工具 ${name}`);
  return currentTool;
}

function schemaKeys(currentTool: StructuredTool) {
  const schema = currentTool.schema as unknown as { shape: Record<string, unknown> };
  return Object.keys(schema.shape);
}

const createTools = buildCreateTools({
  draftId: 101,
  actorUserId: 7,
  emitPatch: () => undefined,
});
const topicTools = buildTopicTools({
  topicId: 202,
  actorUserId: 7,
  scopeUserId: 7,
  emitPatch: () => undefined,
});
const newTopicTools = buildTopicTools({
  actorUserId: 7,
  scopeUserId: 7,
  emitPatch: () => undefined,
});

assert.deepEqual(toolNames(chatTools), [
  'search_articles',
  'search_posts',
  'search_collection',
  'github_search',
  'web_search',
  'list_prompts',
  'load_prompt_template',
]);
assert.deepEqual(toolNames(createTools), [
  'list_prompts',
  'load_prompt_template',
  'get_current_draft',
  'search_posts',
  'get_post_content',
  'web_search',
  'emit_draft_patch',
]);
assert.deepEqual(toolNames(topicTools), [
  'list_prompts',
  'load_prompt_template',
  'search_topics',
  'get_current_topic',
  'search_posts',
  'get_post_content',
  'web_search',
  'read_source_url',
  'emit_topic_patch',
]);
assert.ok(!toolNames(newTopicTools).includes('get_current_topic'));

assert.equal(findTool(chatTools, 'search_posts'), findTool(createTools, 'search_posts'));
assert.equal(findTool(createTools, 'search_posts'), findTool(topicTools, 'search_posts'));
assert.equal(findTool(createTools, 'get_post_content'), findTool(topicTools, 'get_post_content'));
assert.equal(findTool(createTools, 'web_search'), findTool(topicTools, 'web_search'));
assert.equal(findTool(chatTools, 'web_search'), findTool(createTools, 'web_search'));
assert.ok(schemaKeys(findTool(chatTools, 'search_posts')).includes('sort_by'));
assert.deepEqual(schemaKeys(findTool(createTools, 'get_current_draft')), []);
assert.deepEqual(schemaKeys(findTool(topicTools, 'get_current_topic')), []);
assert.equal(findTool(createTools, 'emit_draft_patch').returnDirect, true);

assert.throws(
  () => assembleAgentTools([findTool(chatTools, 'search_posts')], [findTool(createTools, 'search_posts')]),
  /Agent 工具名称重复：search_posts/,
);
assert.equal(
  normalizeLegacyAgentToolNames(
    'search_posts_meta get_draft get_topic get_draft_by_id list_prompt_skills load_prompt_skill_template',
  ),
  'search_posts get_current_draft get_current_topic get_draft_by_id list_prompts load_prompt_template',
);

console.log('AI Agent 工具装配验证通过');
