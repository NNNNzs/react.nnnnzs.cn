---
name: nextjs-page-audit
description: "Manually invoked end-to-end page audit for a running Next.js development app. Use when the user explicitly asks to inspect all UI routes or interactions for build errors, runtime exceptions, hydration mismatches, console warnings, deprecations, blank pages, failed resources, or navigation regressions with Next.js DevTools MCP and a browser."
---

# Next.js Page Audit

对正在运行的 Next.js 开发服务器执行全站 UI 页面巡检。这个 Skill 是诊断和报告工具，不修改应用代码；除非用户在本次手动调用中明确允许，并确认已切换到测试数据库，否则不执行业务写操作。

## 运行契约

- 只在用户明确调用 `$nextjs-page-audit` 时执行；普通开发任务不得隐式触发。
- 不启动、重启或停止 Next.js 服务。服务未运行时报告 `BLOCKED` 并停止页面巡检。
- 不修改 `.env`，不打印 `DATABASE_URL`、密码、Token、Cookie 或其他凭据。
- 默认先执行只读巡检；执行创建、保存或草稿编辑前，要求用户明确确认测试数据库已通过 `.env` 切换。
- 默认跳过发布、删除、权限修改、系统配置、CDN 刷新、第三方授权、支付和其他外部副作用操作；只有用户在本次调用中明确列出，且测试数据库确认后，才可执行。
- 测试数据使用 `e2e-audit-<YYYYMMDD-HHmmss>` 前缀并按用户要求保留；报告必须记录前缀。
- 不因为页面被登录重定向、缺少动态参数或浏览器不可用而宣称通过，统一记录为 `BLOCKED` 或 `SKIPPED`。

## MCP 与浏览器能力

### Next.js DevTools MCP

先调用 `nextjs_index`，确认至少发现一个运行中的 Next.js 开发服务器，并保存端口、URL 和可用工具。随后通过 `nextjs_call` 调用：

1. `get_project_metadata`：记录项目路径和开发服务器信息。
2. `get_routes`：获取 App Router 页面和 Route Handler，随后过滤出 UI 页面。
3. `get_errors`：在巡检前建立错误基线，并在每个页面完成后重新读取。
4. `get_page_metadata`：在有活动浏览器会话时确认实际渲染页面和组件来源。
5. `get_logs`：需要更完整开发日志时获取日志文件路径，并只读取与本次运行相关的内容。

`nextjs_call` 的 `port` 使用字符串形式传递，`toolName` 使用 `nextjs_index` 返回的实际名称；无参数工具不要传 `args`。需要参数的工具严格遵循当前 MCP schema，不要凭经验构造参数。

如果 `nextjs_index`、`nextjs_call` 或 `get_errors` 不可用，停止诊断并报告 MCP 阻塞，不要用静态代码扫描冒充运行时验证。

### 浏览器后端

- 优先使用当前 Codex 可用的内置浏览器控制能力，复用现有会话和登录态。
- 内置浏览器不可用时，检查 `agent-browser` 是否已安装；只有已安装才使用它，不要自动全局安装。
- Next.js DevTools 的 `browser_eval` 是使用 `agent-browser` 的指引入口，不是浏览器驱动本身。
- 浏览器操作只访问当前开发服务器的同源 URL；外部链接记录为 `SKIPPED`，不跟随。
- 浏览器无法收集控制台或网络信息时，报告能力缺失，不把“未收集到错误”解释为“没有错误”。

## 审计流程

### 1. 预检与基线

1. 确认这是用户明确的 `$nextjs-page-audit` 调用。
2. 调用 `nextjs_index`，确认开发服务可发现；记录 `baseUrl`、端口和启动状态。
3. 获取项目元数据和路由清单。
4. 调用 `get_errors` 保存基线，记录基线时间和错误指纹；基线已有问题仍要在报告中列出，但不能误报为本次新增。
5. 如果用户要求业务写操作，先要求确认测试数据库已切换；未确认时仍可继续只读巡检，但所有写操作必须标记 `BLOCKED`。

### 2. 页面路由清单

将 `get_routes` 返回的路由分成以下类别：

- **UI 页面**：公开页、登录页、内容创作中台、管理后台和页面级动态路由。
- **动态模板**：例如 `/[year]/[month]/[date]/[title]`、`/collections/[slug]`、`/c/collections/[id]` 和 `/create/drafts/[id]`。
- **Route Handler**：`/api/*`、`/register`、`/token`、`/revoke`、`/introspect`、OAuth、RSS、Sitemap、robots 和 `/.well-known/*`，不作为浏览器页面巡检目标。
- **重定向页**：例如 `/c` 或 `/glb-model-inspector`，要访问并记录最终 URL，不重复计为独立渲染页面。

以项目的 `docs/reference/ROUTES.md` 和实际页面中的同源链接作为页面入口补充来源。动态模板必须使用页面发现的真实 href、当前已有数据或用户提供的安全样例；没有有效参数时记录 `BLOCKED`，禁止拼接不存在的 ID 冒充测试。

### 3. 页面加载检查

对每个可测试页面：

1. 在浏览器中打开 URL，等待导航和首屏渲染稳定。
2. 记录最终 URL、HTTP/导航状态、页面标题、是否出现空白页和关键可见文本。
3. 调用 `get_errors`，提取当前页面相关的构建错误、运行时异常、水合错误和控制台消息。
4. 在可用时调用 `get_page_metadata`，确认实际路由和渲染贡献组件。
5. 读取浏览器可见的控制台、资源加载和请求失败信息；保留消息原文和源码位置。
6. 对同一页面重复导航或刷新只在需要确认 hydration/首屏问题时进行，避免把重复日志计成多个问题。

### 4. 安全交互检查

在每个页面上检查可见的同源交互，优先覆盖：

- 页眉、侧栏、面包屑、标签、分页和文章链接。
- Tabs、筛选器、排序器、搜索框、抽屉、弹窗、折叠区和主题切换。
- 返回、取消、关闭、预览和只读详情操作。
- 页面中指向其他 UI 路由的同源 `<a>` 或客户端导航。

默认不点击带有删除、移除、发布、提交、支付、授权、刷新 CDN、修改权限、保存系统配置等含义的控件。创建、保存和草稿编辑只有在测试数据库确认且用户明确要求覆盖时执行，并使用统一测试前缀；动作结果和产生的数据 ID 必须写入报告。

对重复导航、循环链接、无限滚动和高数量列表设置有限制：同一 URL 只作为入口测试一次，同一安全交互按页面最多执行一次，分页和列表最多检查首屏及一个后续页，避免无限爬取。

### 5. 错误判定与基线比较

为每条消息生成稳定指纹，至少包含页面 URL、错误类型、规范化消息和源码位置。将本次结果与预检基线比较：

- `FAIL`：Next.js config/build error、未捕获异常、未处理 Promise、React hydration mismatch、页面白屏、无法完成首屏渲染、关键同源资源失败或 5xx。
- `WARN`：React/Ant Design/Next.js 弃用提示、`console.warn`、非关键资源失败、开发模式提示和可恢复警告。
- `BLOCKED`：登录态不足、动态参数缺失、开发服务不可用、MCP 不可用或浏览器能力缺失。
- `SKIPPED`：外部链接、明确跳过的副作用操作、重复 URL 或超出交互上限的动作。

同一指纹已存在于基线时标记 `baseline: true`；本次新出现或消息位置发生变化时标记 `new: true`。即使全部问题都来自基线，也必须在报告中展示，不能输出“无问题”。

### 6. 报告输出

在 `docs/reports/nextjs-page-audit/` 写入一对文件：

- `nextjs-page-audit-<timestamp>.md`：给人阅读的摘要、预检结果、路由矩阵、问题详情、阻塞项、跳过项和测试数据说明。
- `nextjs-page-audit-<timestamp>.json`：遵循 `references/report-schema.md` 的机器可读结果。

报告至少包含：`runId`、开始/结束时间、`baseUrl`、端口、认证状态、测试数据库确认状态、数据前缀、路由状态、执行动作、最终 URL、错误原文、错误来源、基线差异、汇总计数和未覆盖原因。

## 停止条件

- MCP 无法发现开发服务器：只输出预检阻塞，不继续点击页面。
- 用户未确认测试库但要求执行写操作：完成只读部分后停止写操作并记录 `BLOCKED`。
- 浏览器无法连接或无法读取错误：停止依赖浏览器的步骤，并明确缺失能力。
- 发现真实生产域名、外部 OAuth、支付或不可逆业务动作：停止该动作，要求用户明确授权，不自动绕过。

## 输出要求

先给出摘要：通过、失败、警告、阻塞和跳过数量。随后按严重度列出问题，每条问题包含 URL、复现动作、原始消息、源码位置、是否基线问题和建议下一步。不要在未执行修复时宣称问题已修复，也不要把静态检查结果写成浏览器或 MCP 验证结果。
