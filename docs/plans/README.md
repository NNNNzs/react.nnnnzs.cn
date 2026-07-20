# 项目计划列表

本目录存放项目的各种改进计划和重构方案。

## 📋 当前计划

- [后台任务桌面通知模块](./desktop-task-notifications.md) — 🔄 进行中（模块代码、静态检查和任务深链验收已完成，待数据库索引同步与通知授权后验收）
- [MCP Prompt 动态注册改造](./mcp-prompts.md) — 🔄 进行中（Prompt 原语注册、后台暴露开关和静态检查已完成，待真实 MCP 客户端联调）
- [AI Agent 工具定义与装配统一改造](./ai-agent-tools-unification.md) — 🔄 进行中（共享定义、请求级上下文工厂、Agent 白名单和 Prompt scope 已落地；待数据库模板同步与运行联调）
- [草稿库创作 Agent 助手](./create-agent.md) — 🔄 进行中（选题/模板上下文注入、知乎 Markdown、hook/tags 回填已落地；待数据库同步与浏览器联调）
- [内容创作中台建设](./content-creation-platform.md) — 🔄 进行中（Topic Agent、小红书/知乎草稿转换与 Markdown 编辑代码已落地；待数据库同步、场景绑定和浏览器联调）
- [昼夜双主题 3D 首页改造](./cyberpunk-homepage-3d.md) — 🔄 进行中（Blender GLB、旧版视角/明亮度/HUD、动态内容与原有交互已恢复；GLB 开发调参工具取消，后续做移动端与性能验收）
- [AI Lab / LLM 学习实验台建设](./ai-lab-llm-learning.md) — 🔄 进行中（已完成 Run 观测和系统级 Prompts 管理；下一步从 Run 转 Eval Case 并推进 Golden Dataset）
- [Prisma 7 升级](./prisma-7-upgrade.md) — ✅ 已完成（Prisma 7.8.0、`prisma.config.ts`、MariaDB adapter、生成客户端导入、类型检查、构建与 Dockerfile.prod 验证已落地）
- [AI Provider 配置管理重构](./ai-provider-config.md) — 🔄 进行中（Provider + 场景绑定代码已落地；待数据迁移与全场景手动验收）

---

## 📋 已完成计划

完成后的计划文档应移至 `docs/designs/archive/` 或删除。

### 已归档

- [RAG 系统重构](../designs/archive/rag-system-refactor.md) - 向量化系统简化（已完成）
- [聊天系统 LangChain/LangGraph 迁移](../designs/archive/chat-langchain-migration.md) - 迁移至 LangGraph 技术栈（2026-05-10 完成）
- [管理后台移动端适配优化](../designs/archive/admin-mobile-ux.md) - 响应式 Sider/Drawer 切换（commit 6f046a2 完成）

### 已删除

- ~~管理后台性能优化~~ - 内容已实施，详见 [管理后台性能测试指南](../reference/ADMIN-PERFORMANCE-TEST.md)
- ~~聊天系统简化方案~~ - 已被 LangChain/LangGraph 迁移方案替代并实施
- ~~Token 滑动续期方案~~ - 已完成实施，移除 `src/lib/auth.ts` (2026-05-14)

---

## 📝 计划模板

如果需要创建新计划，可以参考以下结构：

```markdown
# [计划标题]

## 问题分析
...

## 解决方案
...

## 实施步骤
1. 阶段 1
2. 阶段 2
...

## 风险评估
...

## 验证清单
- [ ] 待办事项 1
- [ ] 待办事项 2
...
```

---

## 🔄 计划生命周期

```
📝 计划中 → 🔄 进行中 → ✅ 已完成 → 📦 归档/删除
   (plans/)    (plans/)    (实施验证)   (archive/ 或删除)
```

### 状态说明

| 状态 | 说明 | 位置 |
|------|------|------|
| 📝 计划中 | 待实施的方案 | `docs/plans/` |
| 🔄 进行中 | 正在实施的方案 | `docs/plans/` |
| ✅ 已完成 | 实施完成，等待归档 | `docs/plans/` |
| 📦 归档 | 有价值的完成计划 | `docs/designs/archive/` |

---

**最后更新**: 2026-07-16
