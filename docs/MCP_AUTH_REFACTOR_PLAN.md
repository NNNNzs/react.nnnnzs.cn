# MCP 认证重构计划

## 📋 概述

**目标**: 将 MCP 认证从自定义头部 (`x-mcp-account`/`x-mcp-password`) 迁移到标准 OAuth 2.0 Bearer Token，确保与官方 MCP 客户端兼容。

**当前状态**: 使用自定义头部进行认证
**目标状态**: 使用标准 `Authorization: Bearer <token>` 方式

**创建时间**: 2026-01-14
**优先级**: 中
**预计工作量**: 3.5-5.5 小时

---

## 🎯 问题背景

### 当前实现的问题

```typescript
// src/app/api/mcp/route.ts:82-83
const account = headers.get('x-mcp-account') || process.env.MCP_USER_ACCOUNT;
const password = headers.get('x-mcp-password') || process.env.MCP_USER_PASSWORD;
```

### 为什么需要改造？

1. **不兼容官方客户端**: 官方 MCP 客户端使用 `Authorization: Bearer <token>` 标准
2. **违反 OAuth 标准**: MCP SDK 内部使用标准的 OAuth 2.0 Bearer Token 机制
3. **认证信息传递**: 官方 SDK 通过 `req.auth` 传递 `AuthInfo` 对象，而非自定义头部
4. **安全性**: Bearer Token 比传输密码更安全，支持过期和撤销

---

## 🔧 技术方案

### 认证流程对比

#### 当前流程
```
客户端 → x-mcp-account + x-mcp-password → 登录验证 → 工具调用
```

#### 目标流程
```
客户端 → Authorization: Bearer <token> → Token 验证 → AuthInfo → 工具调用
```

### 核心组件

#### 1. MCP 认证适配器 (新增)
**文件**: `src/services/mcpAuth.ts`

```typescript
import { validateToken } from '@/lib/auth';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types';

export const mcpAuthVerifier: OAuthTokenVerifier = {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const user = await validateToken(token);
    if (!user) {
      throw new Error("Invalid or expired token");
    }

    return {
      token,
      clientId: `mcp-client-${user.id}`,
      scopes: ['read', 'write'], // 根据用户角色动态设置
      expiresAt: undefined, // 使用现有 Redis 过期机制
      extra: {
        userId: user.id,
        role: user.role,
        account: user.account
      }
    };
  }
};
```

#### 2. 认证中间件 (可选)
**文件**: `src/lib/mcpMiddleware.ts`

```typescript
import { NextRequest } from 'next/server';
import { getTokenFromRequest, validateToken } from '@/lib/auth';

export async function mcpAuthMiddleware(request: NextRequest) {
  const token = getTokenFromRequest(request.headers);
  if (!token) {
    throw new Error("Missing Bearer token");
  }

  const user = await validateToken(token);
  if (!user) {
    throw new Error("Invalid token");
  }

  return user;
}
```

#### 3. 更新 MCP 路由
**文件**: `src/app/api/mcp/route.ts`

**改造前**:
```typescript
const ensureAuth = async () => {
  const account = headers.get('x-mcp-account') || process.env.MCP_USER_ACCOUNT;
  const password = headers.get('x-mcp-password') || process.env.MCP_USER_PASSWORD;

  if (!account || !password) {
    throw new Error("Missing authentication credentials");
  }

  const result = await login(account, password);
  return result.userInfo;
};
```

**改造后**:
```typescript
const ensureAuth = async () => {
  // 从 Authorization 头获取 Bearer token
  const authHeader = headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error("Missing or invalid Authorization header. Use 'Bearer <token>'");
  }

  const token = authHeader.substring(7); // 去掉 "Bearer "
  const user = await validateToken(token);

  if (!user) {
    throw new Error("Invalid or expired token");
  }

  return user;
};
```

---

## 📊 改造步骤

### 阶段 1: 准备工作
- [ ] 备份当前 `src/app/api/mcp/route.ts`
- [ ] 确认测试环境可用
- [ ] 检查现有客户端使用情况

### 阶段 2: 核心改造
- [ ] 创建 `src/services/mcpAuth.ts`
- [ ] 更新 `src/app/api/mcp/route.ts` 认证逻辑
- [ ] 移除自定义头部认证代码
- [ ] 保持所有工具功能不变

### 阶段 3: 向后兼容性 (可选)
如果需要支持过渡期，可以添加：
```typescript
// 临时兼容层
const ensureAuth = async () => {
  const authHeader = headers.get('authorization');

  // 优先使用标准 Bearer token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const user = await validateToken(token);
    if (user) return user;
  }

  // 回退到自定义头部（带警告）
  const account = headers.get('x-mcp-account');
  const password = headers.get('x-mcp-password');

  if (account && password) {
    console.warn('[MCP] 使用已弃用的自定义头部认证，请迁移到 Bearer Token');
    const result = await login(account, password);
    return result.userInfo;
  }

  throw new Error("Missing authentication credentials");
};
```

### 阶段 4: 测试验证
- [ ] 测试 Bearer token 认证流程
- [ ] 验证所有 MCP 工具功能正常
- [ ] 确认错误处理逻辑
- [ ] 测试并发请求

### 阶段 5: 文档更新
- [ ] 更新 API 文档
- [ ] 添加客户端使用示例
- [ ] 说明迁移路径

---

## 🔄 迁移指南

### 客户端改造示例

#### 改造前
```typescript
// 错误的认证方式
const response = await fetch('/api/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-mcp-account': 'admin',
    'x-mcp-password': 'password123'
  },
  body: JSON.stringify(request)
});
```

#### 改造后
```typescript
// 先登录获取 token
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: 'admin', password: 'password123' })
});
const { token } = await loginResponse.json();

// 使用 Bearer token 调用 MCP
const response = await fetch('/api/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(request)
});
```

---

## 📝 注意事项

### 安全性
- ✅ 确保生产环境使用 HTTPS
- ✅ Token 存储在 Redis 中，有过期时间
- ✅ 支持 Token 撤销（删除 Redis key）

### 兼容性
- ⚠️ 现有客户端需要更新认证方式
- ⚠️ 如果添加兼容层，需要设置迁移时间窗口
- ⚠️ 建议先在测试环境验证

### 性能
- ✅ 复用现有 `validateToken` 函数（已优化）
- ✅ Redis 缓存，性能影响最小
- ✅ 无额外数据库查询

---

## 📅 时间线

| 阶段 | 任务 | 预计时间 | 状态 |
|------|------|----------|------|
| 1 | 准备工作 | 30 分钟 | ⏳ 待开始 |
| 2 | 核心改造 | 1.5-2 小时 | ⏳ 待开始 |
| 3 | 向后兼容 | 30-60 分钟 | ⏳ 待开始 |
| 4 | 测试验证 | 1-2 小时 | ⏳ 待开始 |
| 5 | 文档更新 | 30 分钟 | ⏳ 待开始 |
| **总计** | - | **3.5-5.5 小时** | ⏳ 待开始 |

---

## 🎯 成功标准

- [ ] MCP 工具通过 Bearer Token 正常工作
- [ ] 官方 MCP 客户端可以连接使用
- [ ] 所有现有功能保持不变
- [ ] 错误处理完善
- [ ] 文档清晰完整

---

## 📚 相关文件

### 需要修改的文件
- `src/app/api/mcp/route.ts` - 主要改造文件
- `src/services/mcpAuth.ts` - 新增认证适配器

### 可能需要更新的文件
- `src/lib/mcpMiddleware.ts` - 新增中间件（可选）
- `docs/API.md` - API 文档
- `README.md` - 项目文档

### 现有可复用的文件
- `src/lib/auth.ts` - Token 验证函数
- `src/services/auth.ts` - 登录逻辑
- `src/types/index.ts` - 类型定义

---

## 🚀 下一步行动

当你准备开始改造时，按以下顺序执行：

1. **通知团队**: 告知开发团队即将进行的认证改造
2. **创建分支**: `git checkout -b feature/mcp-auth-refactor`
3. **执行改造**: 按照本计划的步骤进行
4. **测试验证**: 在测试环境充分测试
5. **代码审查**: 提交 PR 进行代码审查
6. **部署**: 灰度发布，监控异常

---

## 📞 支持

如有问题，请参考：
- MCP SDK 文档: https://modelcontextprotocol.io
- 现有认证实现: `src/lib/auth.ts`
- MCP 路由实现: `src/app/api/mcp/route.ts`

---

**文档版本**: v1.0
**最后更新**: 2026-01-14
**创建者**: Claude Code
