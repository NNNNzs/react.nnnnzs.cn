# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
使用中文回答问题

This is a full-stack React blog system built with Next.js 16 + React 19 + Prisma + MySQL. It features:
- Complete frontend blog with article display, tags, archives
- Admin backend for content management
- AI-powered features (chat, content generation, embeddings)
- OAuth 2.0 authentication with MCP (Model Context Protocol) support
- Vector search using Qdrant for semantic search

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
│   ├── [year]/[month]/[date]/[title]/  # Dynamic blog post pages
│   ├── c/                        # Admin dashboard
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
│   └── response.dto.ts           # API response format
│
├── lib/                          # Core utilities
│   ├── auth.ts                   # Authentication utilities
│   ├── redis.ts                  # Redis client & service
│   ├── prisma.ts                 # Prisma client wrapper
│   └── (other utilities)
│
├── services/                     # Business logic layer
│   ├── ai/                       # AI services
│   │   ├── anthropic/            # Anthropic SDK wrapper
│   │   ├── description/          # Article description generation
│   │   ├── text/                 # Text processing
│   │   └── tools/                # AI tools/functions
│   ├── embedding/                # Text embedding services
│   ├── vector/                   # Qdrant vector operations
│   ├── post.ts                   # Post CRUD operations
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
