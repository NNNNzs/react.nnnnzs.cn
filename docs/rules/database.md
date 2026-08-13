# 数据库开发规范

> 本文档是 Prisma 与 MySQL 开发的 source of truth。数据库结构的最终事实来源是 `prisma/schema/*.prisma`。

## 技术栈与配置

- ORM：Prisma 7.8.0
- 数据库：MySQL
- Driver adapter：`@prisma/adapter-mariadb` 7.8.0
- 结构同步：`prisma db push`
- Client 封装：`src/lib/prisma.ts`
- Client 输出：`src/generated/prisma-client`

`DATABASE_URL` 由 `prisma.config.ts` 读取。`prisma/schema/base.prisma` 只声明 MySQL provider，不要把 URL 写回 schema。

## Schema 布局

| 文件 | 当前模型 |
|---|---|
| `base.prisma` | generator、datasource |
| `blog.prisma` | `TbPost`、`TbConfig`、`TbPostVersion`、`TbCollection`、`TbCollectionPost`、`TbComment`、`TbNotification`、`TbNotificationDelivery`、`TbLikeRecord`、`TbEntityChangeLog` |
| `rbac.prisma` | `TbUser`、`LongTermToken`、`TbRole`、`TbPermission`、`TbRolePermission`、`TbUserRole`、`TbApiRegistry` |
| `ai.prisma` | `TbAiProvider`、`TbAiScenario`、`TbAiScenarioBinding`、`TbAiJob`、`TbAiTemplate`、`TbAiTemplateVersion`、`TbImageGenLogLegacy`、`TbChatSession`、`TbChatMessage`、`TbAiLabRun` |
| `content.prisma` | `ContentTopic`、`ContentDraft`、`ContentDraftPreviewShare`、`ContentDraftSlide`、`ContentDraftAsset`、`ContentAsset` |

不要在文档或业务代码中假设存在单文件 `prisma/schema.prisma`。图片与 TTS 新任务写入 `TbAiJob`；`TbImageGenLogLegacy` 仅保留旧表兼容，不接收新任务。

## 当前关键数据约定

### 博客与互动

- `TbPost` 使用 `Int` 自增主键，通过 `created_by` 关联 `TbUser`。
- 向量化状态位于 `TbPost.rag_status`、`rag_error`、`rag_updated_at`。
- 合集与文章通过 `TbCollectionPost` 多对多关联，`[collection_id, post_id]` 唯一。
- 评论回复使用 `TbComment.parent_id` 自关联。
- 通知由 `TbNotification` 持久化，外部投递审计位于 `TbNotificationDelivery`。
- 点赞防刷记录位于 `TbLikeRecord`，实体审计位于 `TbEntityChangeLog`。

### 用户与 RBAC

- 用户、角色、权限通过 `TbUserRole` 与 `TbRolePermission` 关联。
- `TbUser` 不保存单值角色字段；每个登录用户必须至少关联一个启用角色。
- `admin`、`user` 是受保护的系统角色编码，匿名访客不写入角色表。
- 权限码配置源是 `TbPermission`；API 自描述同步到 `TbApiRegistry`。
- 长期 Token 使用 `LongTermToken`，不要另建后台 Token 页面专用表。

### AI 与任务

- Provider 与模型清单位于 `TbAiProvider`。
- 场景绑定位于 `TbAiScenarioBinding`，内置/自定义场景元数据位于 `TbAiScenario`。
- 通用异步任务位于 `TbAiJob`，`type` 当前包括 `image-gen`、`tts`、`text-gen`。
- `TbAiJob.job_id` 是对外 UUID；状态为 `PENDING`、`PROCESSING`、`SUCCESS`、`FAILED`。
- 图片专属参数存入 `ext_json`，生成资源使用 `reserved_cdn_url`、`cos_key`、`cdn_url`。
- Prompt 模板正文版本化存储在 `TbAiTemplateVersion`，主表只保存身份与当前版本。

### 内容创作中台

- `ContentTopic` 管理选题。
- `ContentDraft` 管理平台草稿，`ContentDraftSlide` 管理小红书等分页内容。
- `ContentDraftPreviewShare` 管理草稿公开预览凭证；只保存 SHA-256 `token_hash`，明文 opaque token 仅在创建或轮换响应中返回一次，不能记录、查询或回显。
- 分享凭证的 `expires_at` 与 `revoked_at` 分别表示过期和撤销状态；公开读取必须同时拒绝已过期或已撤销的凭证。
- `ContentAsset` 管理上传、外链与 AI 生成素材。
- `ContentDraftAsset` 管理草稿与素材的多对多使用关系；同一草稿内素材唯一，排序和备注属于关联记录。
- 删除草稿时级联删除 `ContentDraftPreviewShare`、`ContentDraftAsset` 与图卡；删除素材时由草稿关联和图卡引用共同限制，不允许静默解除。
- 从草稿解除素材关联时，业务事务必须先清空同一草稿内引用该素材的 `ContentDraftSlide.asset_id`。

字段、relation、index、default 与物理表名必须直接查看对应 `.prisma` 文件，不在规范中复制可能漂移的完整模型。

## 命名与建模

- Prisma model 沿用现有 `Tb*` 或 `Content*` 风格。
- 物理表通过 `@@map` 使用 `tb_*` 或 `content_*`。
- 现有字段使用 snake_case；新字段跟随所在模型风格。
- 主键默认使用 `Int @id @default(autoincrement())`，除非当前 schema 明确采用其他类型。
- 时间字段按语义选择 `@default(now())`、`@updatedAt` 或 nullable，不要机械补齐。
- 软删除只用于已有 `is_delete` 约定的模型，不要假设所有表都有软删除。
- relation 删除行为必须显式审查；审计记录通常使用 `SetNull`，强所有权子项才使用 `Cascade`。
- 高频筛选、排序和通知轮询必须有与查询顺序匹配的索引。

## 开发流程

1. 修改 `prisma/schema/` 下的对应模块。
2. 格式化并验证 schema。
3. 审查 `db push` 的 destructive change 提示；本项目以 `pnpm prisma:push` 同步开发结构，不生成常规 migration。
4. 确认 `DATABASE_URL` 可用后执行 `pnpm prisma:push` 同步开发数据库；缺失或连接失败时如实记录阻塞，不得生成错误 migration 或声称已同步。
5. 重新生成 Client。
6. 更新消费该模型的服务、类型、脚本与文档。
7. 运行 typecheck。

```bash
npx prisma format
npx prisma validate
pnpm prisma:push
pnpm prisma:generate
pnpm typecheck
```

项目不使用 `prisma migrate dev` 作为常规结构同步流程。生产环境执行 `db push` 前必须备份数据库。

## Prisma Client 使用

业务代码统一复用：

```typescript
import { prisma } from '@/lib/prisma';
```

需要延迟初始化的旧调用可使用 `getPrisma()`，但不要直接 `new PrismaClient()`。开发环境通过 `global.prisma` 复用连接；生成 Client 后若 delegate 仍是旧版本，重启 dev server。

查询规则：

- 用 `select` 限定返回字段，避免返回密码、API key、Token 等敏感列。
- 列表接口必须分页并设置稳定排序。
- 独立写操作需要原子性时使用 `$transaction`。
- 避免 N+1；合理使用 relation `include`、聚合或批量查询。
- 批量写入优先 `createMany` / `updateMany`，同时确认返回值语义。
- 用户输入不得拼接进 `$queryRawUnsafe` / `$executeRawUnsafe`。

## Schema 变更检查

- 是否修改了正确的模块文件？
- model / field 映射是否与现有物理表一致？
- relation、unique、index 与删除行为是否完整？
- 公开分享凭证是否只保存 `token_hash`，并正确处理 `expires_at`、`revoked_at` 与草稿删除级联？
- 是否影响 seed、同步脚本、权限注册或队列恢复？
- 是否运行 format、validate、`pnpm prisma:push`（或如实记录 `DATABASE_URL` / 连接阻塞）、generate、typecheck？
- 是否同步更新 `docs/rules/`、相关设计文档和 README？
- 生产同步前是否完成备份和 destructive change 审查？

## 相关文档

- [Prisma 版本与项目配置](../reference/PRISMA_VERSION_NOTE.md)
- [实体变更日志设计](../designs/features/entity-change-design.md)
- [评论系统设计](../designs/features/comment-system-design.md)
- [合集功能设计](../designs/features/collection-design.md)
- [后台任务队列系统](../designs/infra/task-queue.md)
- [Agent 聊天系统](../designs/chat/rag-chat.md)

最后更新：2026-08-13。
