# 路由结构说明

本文档记录当前 Next.js App Router 路由。事实来源是 `src/app/**/page.tsx` 与 `src/app/**/route.ts`；新增、移动或删除路由时必须同步更新本文档。

## 前台页面

| 路由 | 说明 |
|---|---|
| `/` | 首页 |
| `/[year]/[month]/[date]/[title]` | 文章详情 |
| `/archives` | 归档 |
| `/categories`、`/categories/[category]` | 分类 |
| `/tags`、`/tags/[tag]` | 标签 |
| `/timeline` | 时间线 |
| `/collections`、`/collections/[slug]` | 合集 |
| `/chat` | Agent 聊天 |
| `/login` | 登录 |
| `/bind-wechat` | 绑定微信 |
| `/notifications`、`/notification-policy` | 通知中心与通知策略 |
| `/privacy` | 隐私说明 |
| `/authorize` | OAuth 授权确认 |
| `/glb-model-inspector` | GLB 模型检查器 |

注册、Token、撤销与 introspection 是 Route Handler：`/register`、`/token`、`/revoke`、`/introspect`，不是页面路由。

## 内容创作中台

| 路由 | 说明 |
|---|---|
| `/create` | 创作总览 |
| `/create/topics` | 选题库 |
| `/create/drafts`、`/create/drafts/[id]` | 草稿库与草稿编辑 |
| `/create/assets` | 素材库 |
| `/create/calendar` | 发布日历 |
| `/create/review` | 复盘 |

## 管理后台

| 路由 | 说明 |
|---|---|
| `/c`、`/c/post` | 后台首页与文章管理 |
| `/c/edit/[id]` | 新建或编辑文章；新建使用 `/c/edit/new` |
| `/c/collections`、`/c/collections/[id]` | 合集管理与编辑 |
| `/c/collections/[id]/posts` | 合集文章管理 |
| `/c/comments` | 评论管理 |
| `/c/user`、`/c/user/info` | 用户管理与个人设置 |
| `/c/config` | 系统配置、AI Provider 与场景绑定 |
| `/c/roles`、`/c/permissions` | RBAC 管理 |
| `/c/api-registry` | API 注册表 |
| `/c/chat-logs` | 聊天日志 |
| `/c/vector-search` | 向量检索与向量化运维 |
| `/c/queue` | 后台任务队列监控 |
| `/c/image-gen`、`/c/tts` | 图片生成与语音合成兼容入口 |
| `/c/glb-model-inspector` | 后台 GLB 模型检查器 |
| `/c/ai-lab` | AI Lab 总览 |
| `/c/ai-lab/runs`、`/c/ai-lab/prompts` | Run 观测与 Prompt 管理 |
| `/c/ai-lab/retrieval-playground` | 检索实验台 |
| `/c/ai-lab/image-gen`、`/c/ai-lab/tts` | AI Lab 图片与语音工作台 |
| `/c/ai-lab/eval-cases`、`/c/ai-lab/eval-runs` | 评测占位页面 |

不存在 `/c/users`、`/c/tokens` 或 `/c/vector`；不要在导航和文档中恢复这些旧路径。

## API 路由

以下按当前 `src/app/api` 一级业务域归类。动态段使用 Next.js `[id]` / `[...path]` 语法。

| 路由族 | 主要用途 |
|---|---|
| `/api/post/*` | 文章 CRUD、版本、标签、归档、向量化 |
| `/api/collection/*`、`/api/collections/*` | 合集管理、公开查询与点赞 |
| `/api/comment/*` | 评论 CRUD 与点赞 |
| `/api/user/*`、`/api/auth/*` | 用户、登录态、权限与长期 Token |
| `/api/config/*` | 配置、AI Provider、场景绑定 |
| `/api/chat`、`/api/chat/sessions/*` | Agent 聊天与会话 |
| `/api/search/vector` | 向量搜索 |
| `/api/image-gen/*` | 图片生成、编辑、识别、任务状态、重试与队列 |
| `/api/tts/*` | TTS 提交、日志、任务状态、重试与队列 |
| `/api/create/*` | 选题、草稿、幻灯片、素材与创作总览 |
| `/api/admin/ai-lab/*` | AI Lab Run 与 Prompt 管理 |
| `/api/admin/roles/*`、`/api/admin/permissions` | RBAC 管理 |
| `/api/admin/api-registry` | API 注册表 |
| `/api/admin/chat-logs` | 聊天日志 |
| `/api/notifications/*`、`/api/ai-jobs/notifications` | 站内通知与 AI 任务通知 |
| `/api/mcp` | MCP endpoint |
| `/api/oauth/*`、`/api/oauth-authorization-server`、`/api/oauth-protected-resource/*` | OAuth 2.0 |
| `/api/github/*`、`/api/wechat/*`、`/api/face/*` | 第三方与人脸认证 |
| `/api/fs/*`、`/api/r2-files` | 上传、图片代理与对象存储 |
| `/api/deploy/*`、`/api/activity/commits` | 部署与站点活动 |
| `/api/entity-change/*` | 实体变更历史 |
| `/api/health` | 健康检查 |

未匹配的 `/api/*` 请求由 `/api/[...notfound]` 返回统一 404。

## Well-known 与发现端点

- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource`
- `/.well-known/openid-configuration`
- `/.well-known/[...rest]`
- `/rss.xml`

最后更新：2026-07-28。
