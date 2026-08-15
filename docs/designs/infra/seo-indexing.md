# SEO 收录与 AdSense 内容质量策略

## 目标

站点通过人工文章开关和统一聚合页阈值控制搜索收录。内容质量规则只提供审核提示，不自动修改文章状态，也不影响公开访问、首页、归档、RSS、评论、合集关系或向量数据。

## 文章收录状态

`TbPost.seo_indexable` 是文章的人工 SEO 状态，默认值为 `true`。

- `true`：公开文章允许进入 sitemap，并输出 `index, follow`。
- `false`：文章仍可访问和展示，但退出 sitemap，并输出 `noindex, follow`。
- `hide`、`is_delete` 与 `seo_indexable` 分别表示公开状态、删除状态和搜索收录状态，不能相互替代。

后台编辑器显示以下风险，但不阻止保存或自动关闭开关：

1. Markdown/HTML 清洗后的正文少于 800 字。
2. 描述缺失或清洗后少于 50 字。
3. 标题为空或疑似占位标题。
4. 分类和标签同时缺失。

摘要由 `src/lib/seo-content.ts` 统一生成：移除 Markdown、HTML、代码标记与重复空白，然后按 Unicode 字符截断到 160 字。文章 metadata、Open Graph 和 `BlogPosting` JSON-LD 共用该结果。

## API 与批量审核

创建、更新和列表接口均支持 `seo_indexable`。后台列表可以按该字段筛选，并跨分页保留选中项。

批量接口：

```http
PATCH /api/post/seo-indexing
Content-Type: application/json

{
  "postIds": [1, 2, 3],
  "seoIndexable": false
}
```

约束：

- 每次 1 至 50 篇，ID 必须是正整数且不能重复。
- 复用 `post:edit` 权限和数据范围。
- 任意文章不存在、已删除或超出用户数据权限时，事务整体拒绝。
- 仅更新 `seo_indexable`，不更新正文时间、不创建文章版本、不触发向量任务。
- 每篇实际发生变化的文章记录一条 `seo_indexable` 实体变更日志。

## 页面收录矩阵

| 页面 | 收录规则 | canonical |
|------|----------|-----------|
| 文章详情 | 公开且 `seo_indexable=true` 时 index，否则 noindex | 始终使用正式 `post.path` |
| Tag 详情 | 至少 3 篇允许索引的公开文章时 index | self-canonical |
| 分类详情 | 至少 3 篇允许索引的公开文章时 index | self-canonical |
| 合集详情 | 合集已发布、未删除，且至少 3 篇允许索引的公开文章时 index | self-canonical |
| `/tags`、`/categories`、`/collections` | 始终 index | self-canonical |
| `/archives` | `noindex, follow` | self-canonical |
| `/timeline` | 308 跳转到 `/archives` | 不单独输出 |
| 隐私政策、通知策略 | 始终 index | self-canonical |
| 登录、授权、绑定、通知、聊天、创作、预览、后台 | `noindex, nofollow, noarchive, nocache` | 不参与 sitemap |

旧标题路径只能回退查询 `hide='0' AND is_delete=0` 的文章。命中后永久跳转到正式路径，隐藏或删除文章不能通过标题回退公开。

## Sitemap 与 robots

Sitemap 只包含：

- 首页。
- Tag、分类、合集顶层页。
- 允许索引的公开文章。
- 达到 3 篇阈值的 Tag、分类和已发布合集详情。
- 隐私政策和通知策略。

文章及聚合详情使用真实内容更新时间作为 `lastModified`；没有可靠更新时间的静态页省略该字段。归档、时间线、功能页、禁止索引文章和未达阈值聚合页不进入 sitemap。

`robots.txt` 继续禁止抓取 `/api/` 和 `/c/`，不禁止 `/login`。功能页通过 HTML metadata 与 `X-Robots-Tag` 暴露 noindex，避免爬虫因无法抓取而看不到该指令。

## 缓存影响

仅修改 `seo_indexable` 时刷新：

- 文章正式详情页。
- `/sitemap.xml`。
- 受影响的 Tag、分类和合集详情页。

该操作不刷新首页、归档、RSS、Tag/分类/合集顶层页，也不触发向量化。若一次普通文章保存同时修改正文和 SEO 状态，正文相关的 RSS、合集等原有缓存影响仍然保留。

缓存执行顺序继续遵循：数据库写入成功 → Next.js tag/path 失效 → 源站预热与版本验证 → CDN 刷新 → 公网验证。

## AdSense 与信任信息

AdSense 脚本不在后台、创作、预览、登录、授权、绑定、通知、聊天、归档及政策页面加载。生产发布后仍需在 AdSense 后台同步 URL 排除规则。

Footer 提供作者技术背景、站点定位、原创实践方向、邮箱和 GitHub。隐私政策说明 AdSense、GA4、广告 Cookie、第三方供应商、个性化广告退出入口、数据保存周期、用户控制权和联系渠道。

## 发布与验收

1. 备份生产数据库并增加兼容字段，确认默认值为 `true`。
2. 部署代码后，在后台人工筛选和批量标记历史薄内容。
3. 分别验证源站与公网 HTML 的 `next-rendered-at`、canonical、robots 和 sitemap。
4. 使用浏览器和 Rich Results Test 验证 JSON-LD。
5. 在 Search Console 检查代表性文章、聚合页、归档和旧路径，再提交新版 sitemap。
6. 同步 AdSense URL 排除规则后重新提交审核。

初始迁移不得按内容规则自动批量 noindex。
