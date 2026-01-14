# 🚀 性能检测工具使用指南

## 🎯 快速开始

### 方法 1: 使用 npm 命令 (推荐)
```bash
# 完整性能分析
npm run analyze

# 快速检测
npm run analyze:quick

# 分项检测
npm run analyze:code      # 代码质量
npm run analyze:bundle    # 包大小
npm run analyze:render    # 渲染性能
```

### 方法 2: 使用 Shell 脚本
```bash
# 完整分析
./performance/analyze.sh all

# 快速检测
./performance/analyze.sh quick

# 查看帮助
./performance/analyze.sh help
```

### 方法 3: 直接调用 Node 脚本
```bash
node performance/index.js all
```

## 📋 常用命令速查

| 命令 | 用途 | 适用场景 |
|------|------|----------|
| `npm run analyze:quick` | 快速代码质量检查 | 日常开发 |
| `npm run analyze` | 完整性能分析 | 提交前检查 |
| `npm run analyze:code` | 只检查代码质量 | 代码审查 |
| `npm run analyze:bundle` | 检查包大小 | 优化体积 |
| `npm run analyze:render` | 检查渲染性能 | 优化体验 |

## 🔧 工作流程建议

### 1. 日常开发
```bash
# 每天开始工作时
npm run analyze:quick

# 修复发现的问题
# ...
```

### 2. 提交代码前
```bash
# 确保代码质量
npm run analyze:quick

# 如果评分低于 60，先修复问题再提交
```

### 3. 定期优化
```bash
# 每周一次完整检查
npm run analyze

# 根据报告制定优化计划
```

### 4. 性能问题排查
```bash
# 针对性检查
npm run analyze:render  # 渲染问题
npm run analyze:bundle  # 体积问题
```

## 📊 报告解读

### 评分标准
- **90-100**: 优秀 ✅ - 可以考虑微优化
- **70-89**: 良好 👍 - 有少量优化空间
- **50-69**: 需要改进 ⚠️ - 应该修复问题
- **<50**: 严重问题 🚨 - 必须立即处理

### 问题优先级

#### 🔴 High (立即修复)
- useEffect 缺少依赖数组
- Context 包含大量数据
- 可能导致 bug 或性能问题

#### 🟡 Medium (尽快修复)
- 文件过大 (>300行)
- 组件过大
- 过多的 console.log
- 影响维护性

#### 🟢 Low (可选优化)
- 未使用的变量
- 大型对象字面量
- 内联样式优化

## 🛠️ 常见问题修复

### 1. useEffect 依赖问题
```typescript
// ❌ 错误
useEffect(() => {
  fetchData();
});

// ✅ 正确
useEffect(() => {
  fetchData();
}, []);
```

### 2. 移除 console.log
```bash
# 查找所有 console.log
grep -r "console.log" src/ --include="*.tsx" --include="*.ts"

# 或使用工具
npm run analyze:code | grep "console.log"
```

### 3. 拆分大型文件
```bash
# 查看大型文件
npm run analyze:code | grep "文件过大"
```

### 4. 优化 Context
```typescript
// ❌ 大型 Context
const value = { user, posts, comments, settings, theme, ... };

// ✅ 拆分 Context
const UserContext = createContext();
const PostsContext = createContext();
const ThemeContext = createContext();
```

## 📁 文件说明

```
performance/
├── index.js                    # 统一入口
├── analyze-performance.js      # 代码质量检测
├── check-bundle.js            # 包大小检测
├── analyze-rendering.js       # 渲染性能检测
├── analyze.sh                 # Shell 脚本
├── README.md                  # 详细文档
├── USAGE.md                   # 本指南
├── code-analysis-report.json  # 代码报告
├── bundle-analysis-report.json # 包大小报告
├── rendering-analysis-report.json # 渲染报告
└── summary-report.json        # 综合报告
```

## 💡 最佳实践

### 1. 自动化集成
在 `.git/hooks/pre-commit` 中添加：
```bash
#!/bin/bash
npm run analyze:quick
```

### 2. CI/CD 集成
```yaml
# GitHub Actions
- name: Performance Check
  run: |
    npm run analyze:quick
    SCORE=$(cat performance/summary-report.json | jq '.overallScore')
    if [ "$SCORE" -lt 60 ]; then
      echo "❌ 性能评分过低: $SCORE"
      exit 1
    fi
```

### 3. 团队规范
- 新功能开发后运行 `npm run analyze:quick`
- 代码审查时检查性能报告
- 定期（每周）运行完整分析

## 🎓 学习资源

### 性能优化重点
1. **React Hooks**: 正确使用 useEffect 依赖
2. **代码分割**: 动态导入重型组件
3. **Memoization**: useMemo, useCallback, React.memo
4. **Context 优化**: 拆分大型 Context
5. **构建优化**: Tree Shaking, 压缩

### 常见陷阱
- ❌ useEffect 无依赖数组 → 无限循环
- ❌ 大型 Context → 不必要的重渲染
- ❌ 内联函数 → 子组件重渲染
- ❌ 未优化的列表渲染 → 性能瓶颈

## 🆘 遇到问题？

1. **检查 Node.js 版本**: `node --version` (推荐 v18+)
2. **确认目录结构**: 确保在项目根目录运行
3. **查看错误信息**: 仔细阅读控制台输出
4. **检查文件权限**: 确保脚本有执行权限

## 📈 持续改进

性能优化是一个持续的过程：
- ✅ 定期运行检测
- ✅ 关注评分变化
- ✅ 逐步修复问题
- ✅ 建立团队规范

---

**记住**: 工具只是辅助，最终还是要结合实际用户体验来判断优化效果。
