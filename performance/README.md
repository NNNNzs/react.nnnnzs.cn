# 🚀 React 项目性能检测工具集

这是一个专为 React/Next.js 项目设计的性能检测工具集，帮助你快速识别和解决性能问题。

## 📁 目录结构

```
performance/
├── index.js                    # 统一入口脚本
├── analyze-performance.js      # 代码质量分析
├── check-bundle.js            # 包大小分析
├── analyze-rendering.js       # 渲染性能分析
├── performance-test.js        # 性能测试工具
├── README.md                  # 本说明文档
├── code-analysis-report.json  # 代码分析报告
├── bundle-analysis-report.json # 包大小报告
├── rendering-analysis-report.json # 渲染性能报告
└── summary-report.json        # 综合汇总报告
```

## 🎯 使用方法

### 1. 完整性能分析 (推荐)
```bash
npm run analyze
# 或
npm run perf
```

运行所有检测并生成综合报告。

### 2. 分项检测

#### 代码质量分析
```bash
npm run analyze:code
```
检测内容：
- ✅ useEffect 依赖数组问题
- ✅ console.log 过多
- ✅ 大型文件 (>300行)
- ✅ 未使用的变量
- ✅ 大型对象字面量
- ✅ 内联样式中的复杂计算

#### 包大小分析
```bash
npm run analyze:bundle
```
检测内容：
- ✅ 依赖包大小
- ✅ AI 相关依赖
- ✅ Ant Design 依赖
- ✅ 动态导入机会
- ✅ 构建配置检查

#### 渲染性能分析
```bash
npm run analyze:render
```
检测内容：
- ✅ 组件使用情况
- ✅ useMemo/useCallback 使用
- ✅ React.memo 优化机会
- ✅ Context 数据大小
- ✅ 列表渲染复杂度

#### 快速检测
```bash
npm run analyze:quick
# 或
npm run perf:quick
```
只运行代码质量检测，快速发现问题。

## 📊 报告解读

### 综合评分系统
- **90-100**: 优秀 ✅
- **70-89**: 良好 👍
- **50-69**: 需要改进 ⚠️
- **<50**: 严重问题 🚨

### 严重等级
- 🔴 **High (高)**: 需要立即修复
- 🟡 **Medium (中)**: 建议修复
- 🟢 **Low (低)**: 可选优化

### 报告文件格式

#### code-analysis-report.json
```json
{
  "stats": {
    "files": 161,
    "useEffect": 64,
    "consoleLog": 124,
    "largeFiles": 22
  },
  "issues": [...],
  "warnings": [...],
  "score": 45
}
```

#### summary-report.json
```json
{
  "timestamp": "2026-01-14T13:00:00Z",
  "project": "react.nnnnzs.cn",
  "overallScore": 65,
  "issues": [...],
  "recommendations": [...]
}
```

## 🔧 常见问题修复指南

### 1. useEffect 缺少依赖数组
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

### 2. 过多的 console.log
```bash
# 使用 grep 查找生产环境的 console.log
grep -r "console.log" src/ --include="*.tsx" --include="*.ts"
```

### 3. 大型组件拆分
```typescript
// 将大型组件拆分为多个小组件
// 例如: 600行的组件可以拆分为:
// - Header (100行)
// - Content (300行)
// - Footer (100行)
// - Sidebar (100行)
```

### 4. 动态导入优化
```typescript
// ❌ 静态导入
import HeavyComponent from './HeavyComponent';

// ✅ 动态导入
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton active />,
  ssr: false
});
```

## 🤖 自动化集成

### Git Hooks (可选)
在 `.git/hooks/pre-commit` 中添加：
```bash
#!/bin/bash
echo "🔍 运行性能检测..."
npm run analyze:quick
```

### CI/CD 集成
在 GitHub Actions 中：
```yaml
- name: Performance Check
  run: |
    npm run analyze:quick
    # 如果评分低于阈值则失败
    SCORE=$(cat performance/summary-report.json | jq '.overallScore')
    if [ "$SCORE" -lt 60 ]; then
      echo "❌ 性能评分过低: $SCORE"
      exit 1
    fi
```

## 📈 最佳实践

### 定期检查
```bash
# 每周运行一次完整检查
npm run analyze

# 开发过程中使用快速检查
npm run analyze:quick
```

### 关注重点
1. **优先修复 High 严重级问题**
2. **减少 console.log 使用**
3. **拆分超过 300 行的文件**
4. **正确使用 useEffect 依赖数组**
5. **优化大型 Context 对象**

### 性能优化优先级
1. 🔴 修复 useEffect 依赖问题
2. 🔴 优化大型 Context
3. 🟡 拆分大型文件
4. 🟡 移除 console.log
5. 🟢 使用 React.memo
6. 🟢 动态导入重型组件

## 🔗 相关工具

- **ESLint**: `npm run lint` - 代码规范检查
- **TypeScript**: `npm run typecheck` - 类型检查
- **Prisma**: `npx prisma studio` - 数据库可视化

## 📝 更新日志

### v1.0.0 (2026-01-14)
- ✨ 初始化性能检测工具集
- ✨ 添加统一入口脚本
- ✨ 集成 npm 命令
- ✨ 生成综合报告

---

**提示**: 这些工具只是辅助，最终的性能优化还需要结合实际业务场景和用户体验来判断。
