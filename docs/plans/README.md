# 项目计划列表

本目录存放项目的各种改进计划和重构方案。

## 📋 当前计划

- [赛博朋克 3D 首页改造](./cyberpunk-homepage-3d.md) — 🔄 进行中（阶段一：程序化 3D 房间已接入，视觉打磨中）

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

**最后更新**: 2026-05-20
