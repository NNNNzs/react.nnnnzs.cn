# 统计系统设计文档

## 概述

本文档描述博客系统的数据统计功能实现，包括点赞防刷机制和 Google Analytics 4 (GA4) 事件追踪。

## 功能特性

- IP 防刷（24 小时限制 + Redis 缓存）
- GA4 全量事件追踪
- 数据库配置管理
- 代理支持（国内环境可访问）

## 系统架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   前端组件   │────▶│   API 路由   │────▶│  GA4 服务端  │
│  (点赞按钮)  │     │  (防刷检查)  │     │ (事件发送)  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   数据层     │
                    │ (Redis+DB)  │
                    └─────────────┘
```

## 数据库设计

### TbLikeRecord 表

用于记录点赞行为，实现 IP 防刷功能。

```prisma
model TbLikeRecord {
  id          Int      @id @default(autoincrement())
  target_type String   @db.VarChar(50)  // POST, COLLECTION, COMMENT
  target_id   Int
  ip_address  String   @db.VarChar(45)   // IPv4/IPv6
  created_at  DateTime @default(now())

  @@index([target_type, target_id, ip_address], name: "idx_target_ip")
  @@index([created_at], name: "idx_created_at")
  @@map("tb_like_record")
}
```

### 冗余计数保留

原有的 `TbPost.likes` 和 `TbCollection.total_likes` 字段保留，作为冗余计数字段，用于快速显示。

## 核心服务

### 1. IP 获取工具

**位置**: `src/lib/ip.ts`

**功能**: 从各种代理头部提取真实客户端 IP

```typescript
export function getClientIp(request: NextRequest): string {
  // 按优先级检查：x-forwarded-for > x-real-ip > cf-connecting-ip
  // 支持 IPv4/IPv6 格式验证
  // 开发环境：返回固定值并警告
  // 生产环境：抛出错误
}
```

**支持的代理头部**:
- `x-forwarded-for` - 代理服务器（取第一个 IP）
- `x-real-ip` - Nginx 等
- `cf-connecting-ip` - Cloudflare

### 2. 点赞记录服务

**位置**: `src/services/like-record.ts`

**核心函数**:

```typescript
// 检查是否可以点赞
export async function canLike(targetType: TargetType, targetId: number, request: NextRequest): Promise<boolean>

// 记录点赞行为
export async function recordLike(targetType: TargetType, targetId: number, request: NextRequest): Promise<void>

// 批量查询点赞状态
export async function checkLikedStatus(targetType: TargetType, targetIds: number[], request: NextRequest): Promise<Set<number>>
```

**防刷策略**:
1. 先查 Redis 缓存（24 小时过期）
2. 缓存未命中则查数据库（兜底）
3. 点赞时同时写入 Redis + 数据库
4. 使用 1% 概率触发过期记录清理

### 3. GA4 配置读取

**位置**: `src/lib/analytics-config.ts`

**功能**: 从数据库 `TbConfig` 表读取 GA4 配置，带 5 分钟缓存

```typescript
export interface AnalyticsConfig {
  measurementId: string;
  apiSecret: string;
}

export async function getAnalyticsConfig(): Promise<AnalyticsConfig>
export async function getLikeIpLimitHours(): Promise<number>
export function clearAnalyticsConfigCache(): void
```

**配置项**:
- `ga4.measurement_id` - GA4 Measurement ID
- `ga4.api_secret` - GA4 API Secret
- `like.ip_limit_hours` - 点赞 IP 限制时间（小时），默认 24

### 4. GA4 事件发送

**位置**: `src/lib/analytics.ts`

**功能**: 发送事件到 GA4 Measurement Protocol v2

```typescript
export async function trackEvent(
  eventName: string,
  params: Record<string, string | number | boolean | undefined>,
  request: NextRequest
): Promise<TrackEventResult>

export function createSessionCookie(sessionId: string): string
```

**Session 管理**:
- 使用 Cookie 持久化 Session ID
- Session ID 格式：10 位数字时间戳
- Cookie 有效期：2 年

**事件类型**:
- `like` - 点赞事件
- `page_view` - 页面浏览（客户端 gtag）
- `comment` - 评论事件
- `favorite` - 收藏事件

## API 路由

### 1. 文章点赞 API

**路由**: `PUT /api/post/fav?id=1&type=likes`

**流程**:
1. 检查 IP 限制（`canLike`）
2. 记录点赞（`recordLike`）
3. 更新统计（`TbPost.likes + 1`）
4. 发送 GA4 事件（`trackEvent`）
5. 设置 Session Cookie（如需要）

**响应格式**:
```json
{
  "status": true,
  "message": "操作成功",
  "data": {
    "id": 1,
    "likes": 42
  }
}
```

### 2. 合集点赞 API

**路由**: `POST /api/collections/[identifier]/likes`

**支持**: 通过 id 或 slug 点赞

**流程**: 与文章点赞类似

## 前端组件

### 1. 文章点赞按钮

**位置**: `src/app/[year]/[month]/[date]/[title]/PostLikeButton.tsx`

**特性**:
- 支持初始点赞状态（服务端传入）
- 错误处理（429 状态码显示"已点赞"）
- 类型安全（使用 `AxiosError` 类型）

### 2. 合集点赞按钮

**位置**: `src/components/CollectionLikeButton.tsx`

**特性**: 与文章点赞按钮类似

### 3. GoogleAnalytics 组件

**位置**: `src/components/GoogleAnalytics.tsx`

**功能**: 客户端 GA4 初始化

```typescript
export function GoogleAnalytics({ measurementId }: { measurementId: string })
```

## 配置管理

### 数据库配置项

在管理后台 `/c/config` 添加：

| Key | 标题 | 示例值 | 说明 |
|-----|------|--------|------|
| `ga4.measurement_id` | GA4 Measurement ID | `G-2SG5L56YHQ` | GA4 测量 ID |
| `ga4.api_secret` | GA4 API Secret | `your-secret` | 服务端事件 API 密钥 |
| `like.ip_limit_hours` | 点赞 IP 限制时间 | `24` | 同一 IP 点赞限制时长（小时） |

### 环境变量

```bash
# 代理配置（国内访问 GA4 必需）
HTTPS_PROXY=http://127.0.0.1:7890
```

## GA4 集成说明

### 两套追踪方式

| 类型 | 位置 | 用途 | 可见性 |
|------|------|------|--------|
| 客户端 gtag.js | GoogleAnalytics.tsx | 页面浏览、用户交互 | DebugView / Realtime 即时可见 |
| 服务端 MP | analytics.ts | 点赞等后端事件 | 24-48h 后在标准报告 |

### 注意事项

1. **DebugView 限制**: 只显示客户端 gtag 事件，无法看到服务端事件
2. **事件延迟**: 服务端事件需要等待 24-48 小时才会在标准报告中显示
3. **验证方式**: 开发时查看服务器日志确认发送成功
4. **代理支持**: 国内环境需要配置代理才能访问 GA4

## 性能优化

### 缓存策略

1. **Redis 缓存**: 点赞状态缓存 24 小时
2. **GA4 配置缓存**: 5 分钟 TTL
3. **概率清理**: 1% 概率触发过期记录清理

### 数据库优化

1. **复合索引**: `(target_type, target_id, ip_address)`
2. **时间索引**: `created_at` 用于过期记录查询
3. **批量查询**: `checkLikedStatus` 支持批量查询

## 安全考虑

### IP 防刷限制

- 宽松方案：可被换 IP 绕过
- 适合场景：博客等非关键业务
- 更严格方案：需要登录 + 用户 ID 绑定

### IP 头部伪造

- `x-forwarded-for` 可被伪造
- 不应作为唯一安全依据
- 建议配合其他验证机制

## 数据清理

### 过期记录清理

```typescript
// 1% 概率触发，避免高并发压力
if (Math.random() < 0.01) {
  cleanupOldRecords();
}

async function cleanupOldRecords() {
  const timeLimit = new Date(Date.now() - limitHours * 60 * 60 * 1000);
  await prisma.tbLikeRecord.deleteMany({
    where: { created_at: { lt: timeLimit } }
  });
}
```

### 清理策略

- **应用层**: 概率触发清理
- **MySQL Event**: 定时任务清理（可选）
- **手动清理**: SQL 直接删除（谨慎）

## 相关文件

### 新建文件

| 文件路径 | 用途 |
|---------|------|
| `src/lib/ip.ts` | IP 获取工具 |
| `src/lib/analytics-config.ts` | GA4 配置读取 |
| `src/lib/analytics.ts` | GA4 事件发送 |
| `src/services/like-record.ts` | 点赞记录服务 |
| `src/components/GoogleAnalytics.tsx` | GA4 客户端组件 |
| `src/components/CollectionLikeButton.tsx` | 合集点赞按钮 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `prisma/schema.prisma` | 添加 TbLikeRecord 表 |
| `src/app/api/post/fav/route.ts` | IP 防刷逻辑 |
| `src/app/api/collections/[identifier]/likes/route.ts` | IP 防刷逻辑 |
| `src/app/layout.tsx` | 集成 GoogleAnalytics |
| `src/app/[year]/[month]/[date]/[title]/PostLikeButton.tsx` | 添加点赞状态 |

## 验证测试

### 功能测试

- [ ] 同一 IP 24 小时内只能点赞一次
- [ ] 刷新页面不能绕过限制
- [ ] 点赞状态正确显示
- [ ] GA4 实时报告能看到事件（客户端）
- [ ] 管理后台配置变更后生效

### 性能测试

- [ ] Redis 缓存命中率 > 95%
- [ ] API 响应时间 < 100ms
- [ ] 配置缓存 5 分钟 TTL

## 常见问题

### Q: GA4 事件在 DebugView 看不到？

A: DebugView 只显示客户端 gtag 事件。服务端事件需要等待 24-48 小时才会在标准报告中显示。

### Q: 如何验证服务端事件发送成功？

A: 查看服务器日志，看到 `✅ GA4 事件发送成功` 即表示发送成功。

### Q: 点赞记录表会无限增长吗？

A: 建议设置 MySQL Event 或应用层定时任务定期清理过期记录。当前实现使用 1% 概率触发清理。

### Q: 如何重置点赞限制？

A: 删除 `TbLikeRecord` 表中的对应记录即可。Redis 缓存会在 24 小时后自动过期。
