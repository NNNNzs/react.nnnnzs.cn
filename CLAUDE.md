# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
使用中文回答问题

This is a full-stack React blog system built with Next.js 16 + React 19 + Prisma + MySQL. It features:
- Complete frontend blog with article display, tags, archives, collections
- Admin backend for content management
- AI-powered features (chat, content generation, embeddings)
- OAuth 2.0 authentication with MCP (Model Context Protocol) support
- Vector search using Qdrant for semantic search
- Article collection system for organizing related posts

## Common Commands

### Development
```bash
pnpm dev                    # Start development server
pnpm build                  # Generate Prisma client and build
pnpm start                  # Start production server
pnpm lint                   # Run ESLint
pnpm typecheck              # TypeScript type checking
```

### Database & Prisma
```bash
pnpm prisma:generate        # Generate Prisma client
pnpm prisma:studio          # Open Prisma Studio GUI
pnpm prisma:migrate         # Create and apply migration
pnpm prisma:push            # Push schema to database (dev only)
```

### AI & Vector Search
```bash
pnpm qdrant:init            # Initialize Qdrant collections
```

### Performance Analysis
```bash
pnpm analyze                # Run all analyses (code, bundle, render)
pnpm analyze:code           # Code complexity analysis
pnpm analyze:bundle         # Bundle size analysis
pnpm analyze:render         # Rendering performance
pnpm analyze:quick          # Quick analysis
```

### Docker
```bash
pnpm build:docker           # Build Docker image
pnpm start:docker           # Start with docker-compose (local)
pnpm local:image:push       # Push image to registry
```

### Cursor Rules
```bash
# 项目包含详细的 Cursor IDE 规范
# 参考 .cursor/rules/ 目录：
# - general.mdc: 通用开发规范
# - frontend.mdc: 前端组件和页面规范
# - backend.mdc: API 路由和服务层规范
# - database.mdc: 数据库和 ORM 规范
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16 (App Router) with React 19
- **Database**: Prisma 6.2 + MySQL
- **Cache**: Redis (token storage, session management)
- **Vector DB**: Qdrant (semantic search, embeddings)
- **AI**: Anthropic SDK, LangChain, OpenAI
- **UI**: Ant Design 6 + Tailwind CSS 4
- **Markdown**: md-editor-rt + react-markdown
- **Auth**: OAuth 2.0 + JWT + Long-term tokens
- **File Upload**: Tencent COS

### Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes (REST + MCP)
│   │   ├── post/                 # Blog post APIs
│   │   ├── user/                 # User authentication
│   │   ├── ai/                   # AI generation endpoints
│   │   ├── chat/                 # Chat API (SSE streaming)
│   │   ├── mcp/                  # Model Context Protocol
│   │   ├── oauth/                # OAuth 2.0 endpoints
│   │   └── github/               # GitHub integration
│   ├── .well-known/              # OAuth discovery endpoints
│   │   ├── oauth-authorization-server/
│   │   ├── oauth-protected-resource/
│   │   └── openid-configuration/
│   ├── [year]/[month]/[date]/[title]/  # blog post pages
│   ├── collections/[slug]/       # Collection detail page
│   ├── c/                        # Admin dashboard
│   │   ├── collections/          # Collection management
│   │   │   ├── [id]/             # Collection edit
│   │   │   └── [id]/posts/       # Articles in collection
│   │   ├── edit/[id]/            # Article editor
│   │   ├── post/                 # Post management
│   │   ├── user/                 # User management
│   │   └── config/               # Configuration
│   ├── tags/                     # Tag pages
│   ├── archives/                 # Archive pages
│   ├── chat/                     # AI chat interface
│   └── login/                    # Authentication pages
│
├── components/                   # React components
│   ├── AITextProcessor/          # AI text processing UI
│   ├── CollectionCard/           # Collection card component
│   ├── ArticleCollections/       # Article's collections
│   ├── CollectionSelector/       # Collection selector for posts
│   └── (shared UI components)
│
├── contexts/                     # React Contexts
│   ├── AuthContext.tsx           # Authentication state
│   ├── CurrentPostContext.tsx    # Current post state
│   └── HeaderStyleContext.tsx    # Header styling
│
├── dto/                          # Data Transfer Objects (shared)
│   ├── post.dto.ts               # Post data types
│   ├── user.dto.ts               # User data types
│   ├── config.dto.ts             # Config data types
│   ├── collection.dto.ts         # Collection data types
│   └── response.dto.ts           # API response format
│
├── lib/                          # Core utilities
│   ├── auth.ts                   # Authentication utilities
│   ├── redis.ts                  # Redis client & service
│   ├── prisma.ts                 # Prisma client wrapper
│   ├── long-term-token-auth.ts   # LTK auth middleware
│   ├── ai.ts                     # OpenAI LangChain abstraction
│   └── (other utilities)
│
├── services/                     # Business logic layer
│   ├── ai/                       # AI services
│   │   ├── anthropic/            # Anthropic SDK wrapper
│   │   ├── description/          # Article description generation
│   │   ├── text/                 # Text processing
│   │   └── utils/                # AI prompt templates (OpenAI)
│   ├── embedding/                # Text embedding services
│   ├── vector/                   # Qdrant vector operations
│   ├── post.ts                   # Post CRUD operations
│   ├── collection.ts             # Collection CRUD operations
│   ├── user.ts                   # User operations
│   ├── auth.ts                   # Authentication service
│   ├── mcpAuth.ts                # MCP OAuth adapter
│   ├── token.ts                  # Long-term token service
│   └── post-version.ts           # Article versioning
│
├── entities/                     # (Not used - using Prisma generated types)
├── generated/                    # Prisma generated client
├── hooks/                        # Custom React hooks
├── types/                        # TypeScript types (re-exports)
└── style/                        # Global styles
```

### Key Architectural Patterns

#### 1. **Service Layer Pattern**
All database operations go through the `services/` layer:
```typescript
// src/services/post.ts
export async function getPostList(params: QueryCondition): Promise<PageQueryRes<SerializedPost>>
export async function createPost(data: Partial<TbPost>): Promise<SerializedPost>
```

#### 2. **Permission & Security Architecture** 🔒 IMPORTANT
项目使用多层权限防护系统，所有 API 必须实现权限验证：

**权限层级（自上而下）**：
1. **前端 UI 控制** - 隐藏无权访问的功能（仅用户体验，不提供安全保障）
2. **路由守卫** - 拦截未授权的 URL 访问
3. **API 权限验证** - ✅ 核心防护，所有 API 必须实现
4. **服务层过滤** - 最后一道防线，数据查询时过滤

**角色定义**：
- `admin` - 管理员，拥有所有权限
- `user` - 普通用户，只能管理自己创建的资源
- `guest` - 访客，只能查看公开内容

**权限工具库**（`src/lib/permission.ts`）：
```typescript
// 身份验证
const { user, error } = await validateUserFromRequest(request.headers);
const { user, error } = await requireAdmin(request.headers);  // 仅管理员

// 资源权限检查
canAccessPost(user, post, 'edit')           // 文章权限
canAccessUser(currentUser, targetUserId, 'edit')  // 用户权限
canManageConfig(user)                       // 配置管理
canManageCollections(user)                  // 合集管理
canManageUsers(user)                        // 用户管理
```

**API 权限检查标准模式**：
```typescript
export async function POST(request: NextRequest) {
  // 1. 验证身份
  const { user, error } = await validateUserFromRequest(request.headers);
  if (error) {
    return NextResponse.json(errorResponse(error), { status: 401 });
  }

  // 2. 验证权限（根据场景选择）
  // 2a. 管理员专属操作
  if (!canManageCollections(user)) {
    return NextResponse.json(errorResponse('无权限操作合集'), { status: 403 });
  }

  // 2b. 资源所有权操作
  if (!canAccessPost(user, post, 'edit')) {
    return NextResponse.json(errorResponse('无权限编辑此文章'), { status: 403 });
  }

  // 3. 业务逻辑
  // ...
}
```

**特殊权限规则**：
- **隐藏文章** (`hide=1`)：管理员可查看所有，普通用户只能查看自己的
- **已删除文章** (`is_delete=1`)：仅管理员可查看，普通用户绝对不可见
- **文章列表**：普通用户默认只能看到自己创建的文章
- **合集/配置/用户管理**：仅管理员可操作

**⚠️ 关键原则**：
- ✅ 所有 API 必须在服务端验证权限（不能仅依赖前端）
- ✅ 使用封装的权限检查函数（避免重复代码）
- ✅ 先检查权限，再查询数据（性能优化）
- ❌ 永远不信任客户端请求的角色信息
- ❌ 不能因为前端隐藏了功能就跳过 API 权限检查

详见 `docs/PERMISSION.md` 和 `.cursor/rules/permission.mdc`

#### 2. **DTO Pattern**
Shared type definitions in `src/dto/` for type safety across frontend/backend:
```typescript
// src/dto/post.dto.ts
export interface SerializedPost extends Omit<TbPost, 'tags' | 'date' | 'updated'> {
  tags: string[];  // Array instead of comma-separated string
  date: string;    // ISO string instead of Date object
  updated: string;
}
```

#### 3. **OAuth 2.0 + MCP Integration**
- Standard OAuth 2.0 endpoints at `/.well-known/*`
- MCP JSON-RPC at `/api/mcp`
- Long-term tokens (LTK_ prefix) for CLI usage
- Backward compatibility with custom headers (deprecated)

#### 4. **AI & Vector Search**
- Article content is chunked and embedded
- Stored in Qdrant for semantic search
- Incremental embedding on article updates
- AI tools for content generation and chat

#### 5. **Authentication Flow**
```
1. User login → JWT token stored in Redis (7 days)
2. Token validation → getUserFromToken()
3. Long-term token → LTK_xxx for MCP/CLI
4. OAuth 2.0 → Bearer token for standard clients
```

#### 6. **Admin Page Layout Pattern** ⚠️ IMPORTANT
管理后台布局 (`src/app/c/layout.tsx`) 使用 `overflow-hidden` 来固定高度，因此每个管理页面都需要遵循特定的 flex 布局模式来实现独立滚动。

**标准布局结构：**
```tsx
export default function AdminPage() {
  return (
    <div className="w-full h-full flex flex-col">           {/* 最外层：全高 flex 容器 */}
      <div className="flex-1 flex flex-col min-h-0">        {/* 中间层：flex-1 占据剩余空间，min-h-0 允许收缩 */}
        <div className="mb-6 flex items-center justify-between shrink-0">  {/* 顶部操作栏：固定高度 */}
          <h1 className="text-2xl font-bold">页面标题</h1>
          <Button type="primary">操作按钮</Button>
        </div>

        {/* 可滚动内容区：flex-1 占据剩余空间 */}
        <div className="flex-1 min-h-0">
          {/* 内容区域（可能是表格、表单等） */}
        </div>
      </div>
    </div>
  );
}
```

**关键 Tailwind 类说明：**
- `flex flex-col`: 创建垂直方向的 flex 容器
- `flex-1`: 占据父容器的所有剩余空间
- `min-h-0`: 允许 flex 子项收缩到内容以下（关键！否则无法滚动）
- `shrink-0`: 防止元素被压缩（用于固定高度的头部）
- `overflow-y-auto`: 在需要滚动的容器上添加

**列表页面的表格布局：**
```tsx
<div className="flex-1 min-h-0">
  <Table
    columns={columns}
    dataSource={data}
    scroll={{ y: 'calc(100vh - var(--header-height) - 300px)' }}
    pagination={{ ... }}
  />
</div>
```

**表单页面的滚动布局：**
```tsx
<div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
  <div className="max-w-4xl mx-auto w-full py-6">
    <Card>表单内容</Card>
  </div>
</div>
```

**参考实现：**
- 文章管理页：`src/app/c/post/page.tsx:454-569`
- 合集管理页：`src/app/c/collections/page.tsx:227-263`
- 合集编辑页：`src/app/c/collections/[id]/page.tsx:125-250`
- 合集文章管理：`src/app/c/collections/[id]/posts/page.tsx:203-383`

## Database Schema (Prisma)

### Core Tables
- **TbPost**: Blog articles with versioning support
- **TbUser**: User accounts with GitHub/WeChat integration
- **TbConfig**: System configuration key-value store
- **TbPostVersion**: Article version history
- **TbPostChunk**: Content chunks for vector search
- **LongTermToken**: Persistent tokens for MCP/CLI
- **TbCollection**: Article collections
- **TbCollectionPost**: Collection-post relationship (many-to-many)

### Collection Tables
- **TbCollection**: Collection main table
  - `slug`: URL path (unique)
  - `article_count`, `total_views`, `total_likes`: Redundant stats fields
  - `status`: Status (1-normal, 0-hidden)
- **TbCollectionPost**: Junction table
  - `sort_order`: Order for posts in collection
  - Unique constraint: `(collection_id, post_id)`

### Important Notes
- **No auto-migrations**: Database schema exists externally
- **Tags storage**: Comma-separated string in DB, array in code
- **Dates**: Stored as DateTime, converted to ISO strings in DTOs
- **Soft deletes**: `is_delete` flag instead of actual deletion

## API Endpoints

### Blog Operations
- `GET /api/post/list` - Paginated article list
- `GET /api/post/[id]` - Article by ID
- `POST /api/post/create` - Create article (auth required)
- `PUT /api/post/[id]` - Update article (auth required)
- `DELETE /api/post/[id]` - Delete article (auth required)
- `GET /api/post/tags` - All tags
- `GET /api/post/tags/[tag]` - Articles by tag

### Collection Operations
- `GET /api/collections` - Public collection list
- `GET /api/collections/[slug]` - Collection detail with posts
- `GET /api/collection/list` - Admin collection list (auth required)
- `POST /api/collection/create` - Create collection (auth required)
- `PUT /api/collection/[id]` - Update collection (auth required)
- `DELETE /api/collection/[id]` - Delete collection (auth required)
- `POST /api/collection/[id]/posts` - Add post to collection (auth required)
- `DELETE /api/collection/[id]/posts/[postId]` - Remove post from collection (auth required)
- `PUT /api/collection/[id]/posts/reorder` - Reorder posts in collection (auth required)

### Authentication
- `POST /api/user/login` - Login
- `POST /api/user/register` - Register
- `GET /api/user/info` - User info (auth required)
- `POST /api/user/logout` - Logout
- `POST /api/user/token/long-term` - Generate long-term token

### AI & Chat
- `POST /api/ai/generate/description` - Generate article description
- `POST /api/chat` - AI chat with streaming (SSE)
- `POST /api/mcp` - MCP JSON-RPC endpoint

### OAuth 2.0
- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/oauth-authorization-server`
- `GET /.well-known/openid-configuration`
- `POST /api/oauth/authorize` - Authorization endpoint
- `POST /api/token` - Token endpoint

## Development Workflow

### 1. Local Setup
```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your database, Redis, and COS credentials

# Start development
pnpm dev
```

### 2. Making Changes
- **API changes**: Modify `src/app/api/` routes and `src/services/`
- **UI changes**: Modify `src/app/` pages and `src/components/`
- **Type changes**: Update `src/dto/` and `src/types/`
- **Database**: Update `prisma/schema.prisma` then run `pnpm prisma:push`

### 3. Testing
- Run `pnpm lint` before committing
- Run `pnpm typecheck` to verify types
- Test API endpoints with curl or Postman
- Test MCP integration with Claude Code CLI

### 4. Performance
- Use `pnpm analyze:*` commands to monitor bundle size
- Check `performance/` directory for analysis scripts
- Monitor rendering performance with React DevTools

## Common Tasks

### Adding a New API Endpoint
1. Create route in `src/app/api/[resource]/route.ts`
2. Implement service in `src/services/`
3. Add DTO types in `src/dto/`
4. Update `src/types/index.ts` for exports

### Adding a New Page
1. Create page in `src/app/[route]/page.tsx`
2. Add layout if needed in `src/app/[route]/layout.tsx`
3. Use existing components from `src/components/`

### AI Feature Development
1. Add tools in `src/services/ai/tools/`
2. Update agent configuration in `src/services/react-agent.ts`
3. Add API endpoints in `src/app/api/ai/`

### Database Changes
1. Update `prisma/schema.prisma`
2. Run `pnpm prisma:push` (dev) or create migration
3. Regenerate client: `pnpm prisma:generate`

### Adding Collections to Posts
1. Add collection selector component in article editor
2. Use `CollectionSelector` component
3. Call `/api/collection/[id]/posts` API to manage associations

## Important Files

- **`package.json`** - Dependencies and scripts
- **`next.config.ts`** - Next.js configuration
- **`tsconfig.json`** - TypeScript configuration
- **`eslint.config.mjs`** - ESLint rules
- **`prisma/schema.prisma`** - Database schema
- **`src/lib/auth.ts`** - Authentication utilities
- **`src/services/mcpAuth.ts`** - MCP OAuth adapter
- **`src/services/ai.ts`** - AI service entry point
- **`src/services/post.ts`** - Post CRUD operations

## Environment Variables

Required in `.env`:
```env
# Database
DATABASE_URL="mysql://user:pass@localhost:3306/dbname"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Tencent COS (for file uploads)
SecretId=your-cos-secret-id
SecretKey=your-cos-secret-key
Bucket=your-bucket-name
Region=ap-shanghai
CDN_URL=https://static.your-domain.com

# AI Services (optional)
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...

# Qdrant (for vector search)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-api-key

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Debugging

### Common Issues
1. **Prisma client not found**: Run `pnpm prisma:generate`
2. **Redis connection error**: Check Redis is running
3. **MCP authentication fails**: Verify token format (Bearer / LTK_ / custom headers)
4. **Route conflicts**: Check `.well-known/` paths are not caught by dynamic routes

### Logging
- Check console output for "✅" and "❌" markers
- Redis operations logged in `src/lib/redis.ts`
- Auth flows logged in `src/lib/auth.ts` and `src/services/mcpAuth.ts`

## References

- **Original Projects**:
  - [api.nnnnzs.cn](https://github.com/NNNNzs/api.nnnnzs.cn) - NestJS backend
  - [nnnnzs.cn](https://github.com/NNNNzs/nnnnzs.cn) - Nuxt 3 frontend
- **Documentation**: See `docs/` directory for detailed guides
- **OAuth 2.0**: RFC 8707, 8414, 7636 (PKCE)
- **MCP**: Model Context Protocol specification

## Git Commit Standards

Use semantic commits:
```
feat(auth): add OAuth 2.0 support
fix(api): resolve pagination issue
refactor(components): optimize MarkdownPreview
chore(deps): update dependencies
ci(docker): optimize build workflow
```

See README.md for complete commit message guidelines.

## Additional Rules

项目包含详细的 Cursor IDE 规范文件，提供更深入的开发指导：

- **`.cursor/rules/general.mdc`**: 通用开发规范
  - 项目技术栈详情
  - 文件组织和命名规范
  - TypeScript 严格模式配置
  - 环境变量配置
  - Git 提交规范

- **`.cursor/rules/frontend.mdc`**: 前端开发规范
  - Next.js App Router 约定
  - 客户端 vs 服务端组件
  - Ant Design 6.x 使用规范（API 变更）
  - 管理后台布局模式
  - AI 流式响应处理

- **`.cursor/rules/backend.mdc`**: 后端开发规范
  - API 路由规范
  - 服务层组织（AI 服务目录结构）
  - 认证和授权（withAuth 中间件）
  - AI 工具选择规范（Anthropic vs OpenAI）
  - MCP 服务器规范

- **`.cursor/rules/database.mdc`**: 数据库开发规范
  - Prisma Schema 定义
  - 数据库迁移（使用 `prisma db push`）
  - 查询优化和索引策略
  - 常用命令和工作流程

查看这些文件可以获取更详细的编码标准和最佳实践。