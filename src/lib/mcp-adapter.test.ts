import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { jsonSchemaToZod } from './json-schema-zod';
import type { AuthUser } from '@/types/auth';

process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/test';

function createUser(
  permissions: string[],
  dataScopes: Record<string, string> = {},
): AuthUser {
  return {
    id: 7,
    account: 'tester',
    nickname: 'Tester',
    avatar: null,
    roles: ['user'],
    permissions,
    dataScopes,
  };
}

test('MCP schema 保留对象数组的内部字段约束', () => {
  const schema = z.object(jsonSchemaToZod({
    type: 'object',
    properties: {
      assets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            asset_id: { type: 'number' },
            remark: { type: 'string' },
          },
          required: ['asset_id'],
        },
      },
    },
  }));

  assert.equal(schema.safeParse({ assets: [{ asset_id: 1, remark: '封面' }] }).success, true);
  assert.equal(schema.safeParse({ assets: [{ remark: '缺少 ID' }] }).success, false);
  assert.equal(schema.safeParse({ assets: [{ asset_id: '1' }] }).success, false);
});

test('草稿、素材与图片生成 MCP 工具公开正确的参数结构与主权限', async () => {
  const { API_REGISTRY } = await import('./api-registry');
  const createDraft = API_REGISTRY.find((entry) => entry.mcpToolName === 'create_content_draft');
  const updateDraft = API_REGISTRY.find((entry) => entry.mcpToolName === 'update_content_draft');
  const createAsset = API_REGISTRY.find((entry) => entry.mcpToolName === 'create_content_asset');
  const generateImage = API_REGISTRY.find((entry) => entry.code === 'image_gen');
  const legacyEditImage = API_REGISTRY.find((entry) => entry.mcpToolName === 'edit_image');

  assert.equal(createDraft?.permissionCode, 'content:create');
  assert.equal(updateDraft?.permissionCode, 'content:edit');
  assert.equal(createAsset?.permissionCode, 'content:create');
  assert.equal(generateImage?.permissionCode, 'image:view');
  assert.equal(legacyEditImage, undefined);

  const createDraftProperties = createDraft?.inputSchema?.properties as Record<string, unknown>;
  const updateDraftProperties = updateDraft?.inputSchema?.properties as Record<string, unknown>;
  const createAssetProperties = createAsset?.inputSchema?.properties as Record<string, unknown>;
  const generateImageProperties = generateImage?.inputSchema?.properties as Record<string, unknown>;
  assert.ok(createDraftProperties.assets);
  assert.ok(updateDraftProperties.assets);
  assert.ok(createAssetProperties.draft_id);
  assert.ok(generateImageProperties.images);
  assert.equal(generateImageProperties.mode, undefined);
  assert.deepEqual(generateImage?.inputSchema?.required, ['prompt']);
});

test('MCP 适配器拒绝缺少功能权限的调用并清理 created_by', async () => {
  const { handleMcpToApi } = await import('./mcp-adapter');
  let receivedArgs: Record<string, unknown> | undefined;
  const entry = {
    code: 'test_create',
    name: '测试创建',
    module: 'test',
    method: 'POST' as const,
    apiPath: '/api/test',
    permissionCode: 'content:create',
    mcpEnabled: true,
    mcpToolName: 'test_create',
    handler: async (args: Record<string, unknown>) => {
      receivedArgs = args;
      return { ok: true };
    },
  };

  const denied = await handleMcpToApi(
    entry,
    { created_by: 999 },
    createUser([]),
    new Headers(),
  );
  assert.equal(denied.isError, true);
  assert.equal(receivedArgs, undefined);

  const allowed = await handleMcpToApi(
    entry,
    { created_by: 999, title: '草稿' },
    createUser(['content:create'], { 'content:create': 'self' }),
    new Headers(),
  );
  assert.equal(allowed.isError, undefined);
  assert.deepEqual(receivedArgs, { title: '草稿' });
});

test('self 与 all 数据范围严格区分资源归属', async () => {
  const { hasDataPermission } = await import('./permission');
  const selfUser = createUser(['content:edit'], { 'content:edit': 'self' });
  const allUser = createUser(['content:edit'], { 'content:edit': 'all' });

  assert.equal(hasDataPermission(selfUser, 'content:edit', selfUser.id), true);
  assert.equal(hasDataPermission(selfUser, 'content:edit', 99), false);
  assert.equal(hasDataPermission(selfUser, 'content:edit'), false);
  assert.equal(hasDataPermission(allUser, 'content:edit', 99), true);
  assert.equal(hasDataPermission(createUser([]), 'content:edit', 7), false);
});

test('AI Lab Prompt 模板 CRUD 接口正确注册为 MCP 工具', async () => {
  const { API_REGISTRY } = await import('./api-registry');
  const listPrompts = API_REGISTRY.find((entry) => entry.mcpToolName === 'list_prompt_templates');
  const getPrompt = API_REGISTRY.find((entry) => entry.mcpToolName === 'get_prompt_template');
  const createPrompt = API_REGISTRY.find((entry) => entry.mcpToolName === 'create_prompt_template');
  const updatePrompt = API_REGISTRY.find((entry) => entry.mcpToolName === 'update_prompt_template');
  const createVersion = API_REGISTRY.find((entry) => entry.mcpToolName === 'create_prompt_version');

  assert.ok(listPrompts && listPrompts.mcpEnabled && typeof listPrompts.handler === 'function');
  assert.ok(getPrompt && getPrompt.mcpEnabled && typeof getPrompt.handler === 'function');
  assert.ok(createPrompt && createPrompt.mcpEnabled && typeof createPrompt.handler === 'function');
  assert.ok(updatePrompt && updatePrompt.mcpEnabled && typeof updatePrompt.handler === 'function');
  assert.ok(createVersion && createVersion.mcpEnabled && typeof createVersion.handler === 'function');

  assert.equal(listPrompts.permissionCode, 'config:view');
  assert.equal(getPrompt.permissionCode, 'config:view');
  assert.equal(createPrompt.permissionCode, 'config:edit');
  assert.equal(updatePrompt.permissionCode, 'config:edit');
  assert.equal(createVersion.permissionCode, 'config:edit');

  assert.deepEqual(getPrompt.inputSchema?.required, ['slug']);
  assert.deepEqual(createPrompt.inputSchema?.required, ['slug', 'name', 'content']);
  assert.deepEqual(updatePrompt.inputSchema?.required, ['slug']);
  assert.deepEqual(createVersion.inputSchema?.required, ['slug', 'content']);
});
