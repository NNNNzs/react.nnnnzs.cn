/**
 * RBAC 权限系统 seed 脚本
 *
 * 初始化数据：
 * 1. 权限码（TbPermission）
 * 2. 角色（TbRole）
 * 3. 角色-权限关联（TbRolePermission）
 * 4. 接口注册表（TbApiRegistry）
 *
 * 使用方式：npx tsx prisma/seed-rbac.ts
 */

import { PrismaClient } from '../src/generated/prisma-client';

const prisma = new PrismaClient();

// ============ 权限码定义 ============

interface PermissionSeed {
  code: string;
  name: string;
  module: string;
  type: string;
  sort_order: number;
}

const seedPermissions: PermissionSeed[] = [
  // 文章模块
  { code: 'post:view', name: '查看文章', module: 'post', type: 'api', sort_order: 1 },
  { code: 'post:create', name: '创建文章', module: 'post', type: 'button', sort_order: 2 },
  { code: 'post:edit', name: '编辑文章', module: 'post', type: 'button', sort_order: 3 },
  { code: 'post:delete', name: '删除文章', module: 'post', type: 'button', sort_order: 4 },
  { code: 'post:restore', name: '恢复文章', module: 'post', type: 'button', sort_order: 5 },
  { code: 'post:hide', name: '隐藏文章', module: 'post', type: 'button', sort_order: 6 },
  { code: 'post:view_deleted', name: '查看回收站', module: 'post', type: 'button', sort_order: 7 },
  // 评论模块
  { code: 'comment:manage', name: '管理评论', module: 'comment', type: 'button', sort_order: 1 },
  // 合集模块
  { code: 'collection:view', name: '查看合集', module: 'collection', type: 'menu', sort_order: 1 },
  { code: 'collection:create', name: '创建合集', module: 'collection', type: 'button', sort_order: 2 },
  { code: 'collection:edit', name: '编辑合集', module: 'collection', type: 'button', sort_order: 3 },
  { code: 'collection:delete', name: '删除合集', module: 'collection', type: 'button', sort_order: 4 },
  // 配置模块
  { code: 'config:view', name: '查看配置', module: 'config', type: 'menu', sort_order: 1 },
  { code: 'config:edit', name: '修改配置', module: 'config', type: 'button', sort_order: 2 },
  // 用户模块
  { code: 'user:view', name: '查看用户', module: 'user', type: 'menu', sort_order: 1 },
  { code: 'user:manage', name: '管理用户', module: 'user', type: 'button', sort_order: 2 },
  { code: 'user:role:assign', name: '分配角色', module: 'user', type: 'button', sort_order: 3 },
  // 工具模块
  { code: 'queue:view', name: '队列监控', module: 'tool', type: 'menu', sort_order: 1 },
  { code: 'vector:view', name: '向量检索', module: 'tool', type: 'menu', sort_order: 2 },
  { code: 'tts:view', name: '语音合成', module: 'tool', type: 'menu', sort_order: 3 },
  { code: 'image:view', name: 'AI 图片生成', module: 'tool', type: 'menu', sort_order: 4 },
  { code: 'file:upload', name: '上传附件', module: 'tool', type: 'button', sort_order: 5 },
];

// ============ 角色定义 ============

interface RoleSeed {
  code: string;
  name: string;
  description: string;
  permissions: Array<{
    permission_code: string;
    data_scope: string;
  }>;
}

const seedRoles: RoleSeed[] = [
  {
    code: 'admin',
    name: '管理员',
    description: '系统管理员，拥有所有权限',
    permissions: seedPermissions.map(p => ({
      permission_code: p.code,
      data_scope: 'all',
    })),
  },
  {
    code: 'user',
    name: '普通用户',
    description: '普通用户，管理自己的内容',
    permissions: [
      { permission_code: 'post:view', data_scope: 'self' },
      { permission_code: 'post:create', data_scope: 'self' },
      { permission_code: 'post:edit', data_scope: 'self' },
      { permission_code: 'post:hide', data_scope: 'self' },
    ],
  },
];

// ============ 接口注册表定义 ============

interface ApiRegistrySeed {
  code: string;
  name: string;
  description?: string;
  module: string;
  api_path: string;
  api_method: string;
  mcp_enabled: boolean;
  mcp_tool_name?: string;
  permission_code?: string;
  input_schema?: Record<string, unknown>;
  cache_tags?: string[];
}

const seedApiRegistry: ApiRegistrySeed[] = [
  // ---- 文章模块 ----
  {
    code: 'post_create',
    name: '创建文章',
    description: '创建新博客文章，支持标签、合集、分类等。先读取 blog://tags 和 blog://collections 资源了解现有标签和合集。',
    module: 'post',
    api_path: '/api/post/create',
    api_method: 'POST',
    mcp_enabled: true,
    mcp_tool_name: 'create_article',
    permission_code: 'post:create',
    cache_tags: ['post', 'home', 'post-list', 'tags', 'tag-list', 'archives'],
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '文章标题' },
        content: { type: 'string', description: '文章内容（Markdown）' },
        category: { type: 'string', description: '分类' },
        tags: { type: 'string', description: '逗号分隔的标签' },
        collections: { type: 'string', description: '逗号分隔的合集ID或slug' },
        description: { type: 'string', description: '简短描述' },
        cover: { type: 'string', description: '封面图URL' },
        hide: { type: 'string', description: '1隐藏 0显示' },
      },
      required: ['title', 'content'],
    },
  },
  {
    code: 'post_update',
    name: '更新文章',
    module: 'post',
    api_path: '/api/post/[id]',
    api_method: 'PUT',
    mcp_enabled: true,
    mcp_tool_name: 'update_article',
    permission_code: 'post:edit',
    cache_tags: ['post', 'home', 'post-list', 'tags', 'tag-list', 'archives'],
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '文章ID' },
        title: { type: 'string', description: '文章标题' },
        content: { type: 'string', description: '文章内容（Markdown）' },
        category: { type: 'string', description: '分类' },
        tags: { type: 'string', description: '逗号分隔的标签' },
        description: { type: 'string', description: '简短描述' },
        cover: { type: 'string', description: '封面图URL' },
        hide: { type: 'string', description: '1隐藏 0显示' },
        add_to_collections: { type: 'string', description: '添加到的合集ID或slug，逗号分隔' },
        remove_from_collections: { type: 'string', description: '移除的合集ID或slug，逗号分隔' },
      },
      required: ['id'],
    },
  },
  {
    code: 'post_delete',
    name: '删除文章',
    module: 'post',
    api_path: '/api/post/[id]',
    api_method: 'DELETE',
    mcp_enabled: true,
    mcp_tool_name: 'delete_article',
    permission_code: 'post:delete',
    cache_tags: ['post', 'home', 'post-list', 'tags', 'tag-list', 'archives'],
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '文章ID' },
      },
      required: ['id'],
    },
  },
  {
    code: 'post_get',
    name: '获取文章',
    module: 'post',
    api_path: '/api/post/[id]',
    api_method: 'GET',
    mcp_enabled: true,
    mcp_tool_name: 'get_article',
    permission_code: 'post:view',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '文章ID' },
        title: { type: 'string', description: '文章标题（ID和标题二选一）' },
      },
    },
  },
  {
    code: 'post_list',
    name: '文章列表',
    module: 'post',
    api_path: '/api/post/list',
    api_method: 'GET',
    mcp_enabled: true,
    mcp_tool_name: 'list_articles',
    permission_code: 'post:view',
    input_schema: {
      type: 'object',
      properties: {
        pageNum: { type: 'number', description: '页码（默认1）' },
        pageSize: { type: 'number', description: '每页数量（默认10）' },
        keyword: { type: 'string', description: '搜索关键词' },
        hide: { type: 'string', description: '可见性过滤' },
      },
    },
  },
  // ---- 上传模块 ----
  {
    code: 'upload_file',
    name: '上传附件',
    description: '上传附件到腾讯云 COS，MCP 调用时传入 base64 文件内容、文件名和 MIME 类型，返回 CDN URL。',
    module: 'upload',
    api_path: '/api/fs/upload',
    api_method: 'POST',
    mcp_enabled: true,
    mcp_tool_name: 'upload_file',
    permission_code: 'file:upload',
    input_schema: {
      type: 'object',
      properties: {
        base64: { type: 'string', description: 'base64 编码的文件内容，支持带 data URL 前缀' },
        url: { type: 'string', description: '公网可访问的文件 URL；传 url 时服务端会下载并转存到 COS' },
        filename: { type: 'string', description: '文件名，例如 image.png、report.pdf' },
        mimeType: { type: 'string', description: '文件 MIME 类型，例如 image/png、application/pdf' },
        ext: { type: 'string', description: '可选文件扩展名，例如 png、pdf；未传时从 filename 推断' },
      },
    },
  },
  // ---- 图片生成模块 ----
  {
    code: 'image_gen',
    name: 'AI图片生成',
    description: '使用 AI 生成图片(文生图)。图片生成通常需要 30-90 秒，请耐心等待，不要重试。无异步通知机制，超时(90s)将报错。',
    module: 'image',
    api_path: '/api/image-gen',
    api_method: 'POST',
    mcp_enabled: true,
    mcp_tool_name: 'generate_image',
    permission_code: 'image:view',
    input_schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '图片描述提示词' },
        size: { type: 'string', description: '图片尺寸，如 1024x1024' },
        quality: { type: 'string', description: '图片质量: high 或 medium' },
      },
      required: ['prompt'],
    },
  },
  // ---- 合集模块（仅 API，不暴露 MCP）----
  {
    code: 'collection_create',
    name: '创建合集',
    module: 'collection',
    api_path: '/api/collection/create',
    api_method: 'POST',
    mcp_enabled: false,
    permission_code: 'collection:create',
  },
  {
    code: 'collection_update',
    name: '编辑合集',
    module: 'collection',
    api_path: '/api/collection/[id]',
    api_method: 'PUT',
    mcp_enabled: false,
    permission_code: 'collection:edit',
  },
  {
    code: 'collection_delete',
    name: '删除合集',
    module: 'collection',
    api_path: '/api/collection/[id]',
    api_method: 'DELETE',
    mcp_enabled: false,
    permission_code: 'collection:delete',
  },
  // ---- 配置模块 ----
  {
    code: 'config_update',
    name: '修改配置',
    module: 'config',
    api_path: '/api/config/[key]',
    api_method: 'PUT',
    mcp_enabled: false,
    permission_code: 'config:edit',
  },
];

// ============ Seed 函数 ============

async function seedPermissions_() {
  console.log('🔐 Seeding permissions...');

  for (const perm of seedPermissions) {
    await prisma.tbPermission.upsert({
      where: { code: perm.code },
      update: {
        name: perm.name,
        module: perm.module,
        type: perm.type,
        sort_order: perm.sort_order,
      },
      create: {
        code: perm.code,
        name: perm.name,
        module: perm.module,
        type: perm.type,
        sort_order: perm.sort_order,
        status: 1,
      },
    });
  }

  console.log(`✅ Seeded ${seedPermissions.length} permissions`);
}

async function seedRoles_() {
  console.log('👥 Seeding roles...');

  for (const role of seedRoles) {
    // 创建或更新角色
    const createdRole = await prisma.tbRole.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
      },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        status: 1,
      },
    });

    // 删除旧的权限关联
    await prisma.tbRolePermission.deleteMany({
      where: { role_id: createdRole.id },
    });

    // 创建新的权限关联
    for (const perm of role.permissions) {
      const permission = await prisma.tbPermission.findUnique({
        where: { code: perm.permission_code },
      });

      if (permission) {
        await prisma.tbRolePermission.create({
          data: {
            role_id: createdRole.id,
            permission_id: permission.id,
            data_scope: perm.data_scope,
          },
        });
      }
    }
  }

  console.log(`✅ Seeded ${seedRoles.length} roles`);
}

async function seedApiRegistry_() {
  console.log('📡 Seeding API registry...');

  for (const entry of seedApiRegistry) {
    await prisma.tbApiRegistry.upsert({
      where: { code: entry.code },
      update: {
        name: entry.name,
        description: entry.description,
        module: entry.module,
        api_path: entry.api_path,
        api_method: entry.api_method,
        mcp_tool_name: entry.mcp_tool_name,
        permission_code: entry.permission_code,
        input_schema: entry.input_schema ? JSON.stringify(entry.input_schema) : null,
        cache_tags: entry.cache_tags?.join(','),
      },
      create: {
        code: entry.code,
        name: entry.name,
        description: entry.description,
        module: entry.module,
        api_path: entry.api_path,
        api_method: entry.api_method,
        mcp_enabled: entry.mcp_enabled ? 1 : 0,
        mcp_tool_name: entry.mcp_tool_name,
        permission_code: entry.permission_code,
        input_schema: entry.input_schema ? JSON.stringify(entry.input_schema) : null,
        cache_tags: entry.cache_tags?.join(','),
        status: 1,
      },
    });
  }

  console.log(`✅ Seeded ${seedApiRegistry.length} API registry entries`);
}

// ============ 主函数 ============

async function main() {
  console.log('🚀 Starting RBAC seed...\n');

  try {
    await seedPermissions_();
    await seedRoles_();
    await seedApiRegistry_();

    console.log('\n✨ RBAC seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
