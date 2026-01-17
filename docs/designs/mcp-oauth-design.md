# MCP OAuth 2.0 认证升级总结

**时间**: 2026-01-15
**目标**: 将 MCP 服务从自定义 Headers 认证升级为 OAuth 2.0 标准，兼容 Claude Code CLI

---

## 🎯 核心问题

### 1. 不兼容性问题
- **旧方式**: 自定义 Headers (`x-mcp-account`, `x-mcp-password`)
- **新需求**: Claude Code CLI 要求标准 OAuth 2.0 Bearer Token
- **挑战**: 需要同时支持新旧方式，保证各种 MCP Client 都能使用

### 2. 路由冲突问题
- 博客动态路由 `/[year]/[month]/[date]/[title]/` 会捕获 OAuth 端点
- 导致系统路径被当作博客文章处理，出现 404 错误

### 3. OAuth 自动发现冲突
- Claude Code CLI 自动发现 `registration_endpoint`
- 但该端点需要认证，导致认证循环

---

## 🔧 解决方案

### 方案 1: 路由结构调整

```
src/app/
├── .well-known/                    # OAuth 2.0 标准端点（根路径）
│   ├── oauth-protected-resource/   → /.well-known/oauth-protected-resource
│   ├── oauth-authorization-server/ → /.well-known/oauth-authorization-server
│   ├── openid-configuration/       → /.well-known/openid-configuration
│   └── [...rest]/                  → /.well-known/* (Catch-all)
│
└── api/
    ├── mcp/                         → /api/mcp (MCP JSON-RPC)
    └── auth/                        → /api/auth/* (认证端点)
        ├── login/
        ├── token/
        ├── register/
        ├── authorize/
        ├── introspect/
        └── revoke/
```

**关键**: Next.js 静态路由优先级 > 动态路由

### 方案 2: 路由防护机制

在博客路由中添加三重保护：

```typescript
// src/app/[year]/[month]/[date]/[title]/page.tsx

// 1. generateMetadata 中
if (year.startsWith('.') || year === 'api' || year.startsWith('_')) {
  return { title: "Not Found" };
}

// 2. getPost 中
if (year.startsWith('.') || year === 'api' || year.startsWith('_')) {
  console.log("⚠️ 检测到系统路径，跳过数据库查询");
  return null;
}

// 3. PostDetail 组件中
if (year.startsWith('.') || year === 'api' || year.startsWith('_')) {
  notFound();
}
```

### 方案 3: 移除 registration_endpoint

**问题**: OAuth 元数据中的 `registration_endpoint` 导致 Claude Code CLI 自动注册失败

**解决**: 从元数据中移除，改为手动配置流程
```typescript
// ✅ 移除后
{
  "issuer": "http://localhost:3000",
  "authorization_endpoint": "http://localhost:3000/authorize",
  "token_endpoint": "http://localhost:3000/token",
  // ❌ 不包含 registration_endpoint
}
```

### 方案 4: 认证适配器

```typescript
// src/services/mcpAuth.ts - authenticateMcpRequestEnhanced()

export async function authenticateMcpRequestEnhanced(headers: Headers) {
  const token = getTokenFromRequest(headers);

  // 1. OAuth 2.0 Bearer Token (标准)
  const user = await validateToken(token);
  if (user) return user;

  // 2. 长期 Token (LTK_ 前缀)
  if (token.startsWith('LTK_')) {
    const userId = await validateLongTermToken(token);
    if (userId) {
      return await getUserById(userId);
    }
  }

  // 3. 向后兼容：自定义 Headers
  const account = headers.get('x-mcp-account');
  const password = headers.get('x-mcp-password');
  if (account && password) {
    console.warn('[MCP] ⚠️ 使用已弃用的自定义头部认证');
    const { login } = await import('@/services/auth');
    const result = await login(account, password);
    if (result) return result.userInfo;
  }

  throw new Error("Invalid token");
}
```

### 方案 5: 长期 Token 机制

**数据库表**:
```prisma
model LongTermToken {
  id          String    @id @default(uuid())
  token       String    @unique  // LTK_ 前缀
  userId      Int
  expiresAt   DateTime? // null = 永久
  description String
  createdAt   DateTime  @default(now())
  lastUsed    DateTime?
}
```

**用户流程**:
```
1. 登录 → 获取普通 Token
2. 访问 /c/user/info
3. 生成长期 Token (选择有效期)
4. 配置 Claude Code CLI
```

---

## 📋 完整改造清单

### 新增文件
- `src/app/.well-known/oauth-protected-resource/route.ts`
- `src/app/.well-known/oauth-authorization-server/route.ts`
- `src/app/.well-known/openid-configuration/route.ts`
- `src/app/.well-known/[...rest]/route.ts`
- `src/app/api/auth/` (完整认证端点)
- `src/services/mcpAuth.ts` (认证适配器)
- `src/services/token.ts` (长期 Token 服务)
- `src/components/LongTermTokenCard.tsx` (管理 UI)
- `src/lib/long-term-token-auth.ts` (Token 认证库)
- `src/app/api/user/token/` (Token API)

### 修改文件
- `src/app/[year]/[month]/[date]/[title]/page.tsx` (添加防护)
- `src/app/api/mcp/route.ts` (简化 GET 方法)
- `src/lib/auth.ts` (支持 OAuth Token 验证)
- `src/lib/prisma.ts` (更新 mock)
- `src/lib/redis.ts` (添加 setex)
- `src/dto/user.dto.ts` (添加 Token DTO)
- `prisma/schema.prisma` (添加 LongTermToken 表)

### 删除文件
- `src/app/api/mcp/.well-known/` (整个目录，重复)

---

## 🧪 测试验证

### 1. OAuth 端点测试
```bash
curl http://localhost:3000/.well-known/oauth-protected-resource
# 应返回标准 OAuth 元数据（不含 registration_endpoint）
```

### 2. 路由保护测试
```bash
# 测试系统路径
curl http://localhost:3000/.well-known/invalid-path
curl http://localhost:3000/api/mcp/.well-known/openid-configuration
# 检查日志，应该看到"检测到系统路径，跳过博客路由"
```

### 3. Claude Code CLI 完整流程
```bash
# 1. 生成 Token
./scripts/get-claude-token.sh

# 2. 配置
claude mcp add MyBlog http://localhost:3000/api/mcp \
  --header "Authorization: Bearer LTK_xxx"

# 3. 验证
claude mcp list
# 应显示: ✓ connected & authenticated

# 4. 测试工具
# 在 Claude Code 中: "请列出最近的文章"
```

### 4. 向后兼容测试
```bash
# 旧 Headers 方式（应工作但显示警告）
curl -X POST http://localhost:3000/api/mcp \
  -H "x-mcp-account: admin" \
  -H "x-mcp-password: password" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

---

## 📊 改造前后对比

| 方面 | 改造前 | 改造后 |
|------|--------|--------|
| **认证协议** | 自定义 Headers | OAuth 2.0 标准 |
| **Token 格式** | 无结构 | Bearer / LTK_ 前缀 |
| **OAuth 端点** | `/api/mcp/.well-known/*` | `/.well-known/*` ✅ |
| **Claude CLI 兼容** | ❌ 不支持 | ✅ 完全支持 |
| **自动发现** | ❌ | ✅ |
| **长期配置** | ❌ | ✅ |
| **向后兼容** | - | ✅ |
| **多 Client 支持** | 有限 | ✅ 全面 |

---

## 🎯 核心技术要点

### 1. Next.js 路由优先级
```
静态路由 > Catch-all > 动态路由
```

### 2. OAuth 2.0 标准
- RFC 8707: Protected Resource Metadata
- RFC 8414: Authorization Server Metadata
- RFC 7636: PKCE 支持

### 3. 适配器模式
统一处理多种认证方式，输出标准 User 对象

### 4. 渐进迁移
保留旧方式 + 警告 + 新标准

---

## 🚀 使用流程

### Claude Code CLI 配置
```bash
# 1. 登录获取 Token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"admin","password":"your-password"}' | jq -r '.token')

# 2. 通过 Web UI 生成长期 Token
# 访问: http://localhost:3000/c/user/info

# 3. 配置
claude mcp add MyBlog http://localhost:3000/api/mcp \
  --header "Authorization: Bearer LTK_xxx"

# 4. 验证
claude mcp list
```

### 其他 Client
```bash
# 方式 A: OAuth 2.0 Bearer Token (推荐)
claude mcp add MyBlog http://localhost:3000/api/mcp \
  --header "Authorization: Bearer LTK_xxx"

# 方式 B: 旧 Headers (向后兼容)
claude mcp add MyBlog http://localhost:3000/api/mcp \
  --header "x-mcp-account: admin" \
  --header "x-mcp-password: password"
```

---

## 🎉 改造成果

### ✅ 已完成
1. OAuth 2.0 标准端点实现
2. Claude Code CLI 完全兼容
3. 长期 Token 机制
4. Web UI 管理界面
5. 向后兼容适配器
6. 路由冲突完全解决
7. 全面的测试验证

### 🔑 核心优势
1. **标准兼容**: 符合 OAuth 2.0 RFC
2. **Client 通用**: 支持各种 MCP Client
3. **易于配置**: Web UI + 自动脚本
4. **平滑迁移**: 旧方式逐步淘汰
5. **安全可靠**: 多层验证机制

### 📚 相关文档
- 博客文章: "MCP 认证升级：从 Headers 到 OAuth 2.0"
- 测试脚本: `scripts/test-mcp-oauth.sh`
- Token 生成: `scripts/get-claude-token.sh`

---

**状态**: ✅ 已完成并测试通过
**兼容性**: Claude Code CLI + 其他 MCP Client
**标准**: OAuth 2.0 RFC 8707, 8414, 7636
