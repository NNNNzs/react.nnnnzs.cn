# 🔄 ESM 转换说明

## 转换概述

所有性能检测工具已从 CommonJS (`require/exports`) 转换为 ES Module (`import/export`) 格式，以适配现代 Node.js 环境。

## 📋 转换的文件

### ✅ 已转换为 ESM
- ✅ `index.js` - 统一入口脚本
- ✅ `analyze-performance.js` - 代码质量分析
- ✅ `check-bundle.js` - 包大小分析
- ✅ `analyze-rendering.js` - 渲染性能分析

### ⚠️ 保持 CommonJS
- ⚠️ `performance-test.js` - Playwright 测试脚本 (复杂依赖，建议单独维护)

## 🔧 关键变更

### 1. package.json
```diff
{
  "name": "react.nnnnzs.cn",
  "version": "0.1.0",
  "private": true,
+ "type": "module",
  "scripts": {
    ...
  }
}
```

### 2. 模块导入
```diff
// CommonJS
- const fs = require('fs');
- const path = require('path');

// ESM
+ import fs from 'fs';
+ import path from 'path';
```

### 3. 路径处理
```diff
// CommonJS
- const __filename = __filename;
- const __dirname = __dirname;

// ESM
+ import { fileURLToPath } from 'url';
+ const __filename = fileURLToPath(import.meta.url);
+ const __dirname = path.dirname(__filename);
```

### 4. 导出方式
```diff
// CommonJS
- module.exports = PerformanceAnalyzer;

// ESM
+ export default PerformanceAnalyzer;
+ export { runAnalysis, generateSummaryReport };
```

### 5. 入口检测
```diff
// CommonJS
- if (require.main === module) {
-   main();
- }

// ESM
+ if (process.argv[1] === fileURLToPath(import.meta.url)) {
+   main();
+ }
```

## 🎯 使用方式

所有 npm 命令保持不变：

```bash
# 完整分析
npm run analyze

# 快速检测
npm run analyze:quick

# 分项检测
npm run analyze:code
npm run analyze:bundle
npm run analyze:render

# Shell 脚本
./performance/analyze.sh all
```

## 📊 兼容性

- **Node.js**: v16+ (推荐 v18+)
- **npm**: v7+
- **平台**: Windows, macOS, Linux

## 🚨 注意事项

### 1. 相对路径
ESM 中 `__dirname` 需要手动计算：
```javascript
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

### 2. 动态导入
如果需要动态导入，使用：
```javascript
const module = await import('./module.js');
```

### 3. Windows 路径
Windows 路径分隔符需要处理：
```javascript
// 路径比较时
const isMainModule = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`;
```

## 🔍 调试技巧

### 检查 ESM 是否生效
```bash
# 查看 package.json
grep '"type": "module"' package.json

# 测试导入
node -e "import('./performance/index.js').then(m => console.log('OK'))"
```

### 常见错误

#### 1. `SyntaxError: Cannot use import statement outside a module`
**原因**: package.json 缺少 `"type": "module"`
**解决**: 添加 `"type": "module"`

#### 2. `ReferenceError: __dirname is not defined`
**原因**: ESM 没有内置 `__dirname`
**解决**: 手动计算：
```javascript
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

#### 3. `ERR_MODULE_NOT_FOUND`
**原因**: 文件扩展名缺失或路径错误
**解决**: ESM 必须写完整路径：
```javascript
// ❌ 错误
import './module';

// ✅ 正确
import './module.js';
```

## 📝 代码规范

### ESM 最佳实践

1. **始终使用完整路径**
```javascript
import fs from 'fs';
import path from 'path';
```

2. **避免循环依赖**
```javascript
// 使用动态导入打破循环
const module = await import('./module.js');
```

3. **命名导出优先**
```javascript
// 推荐
export { func1, func2 };

// 而不是
export default { func1, func2 };
```

4. **异步导入**
```javascript
// 对于大型依赖
const heavyModule = await import('./heavy-module.js');
```

## 🎓 为什么使用 ESM？

### 优势
- ✅ **现代标准**: ES 模块是 JavaScript 官方标准
- ✅ **Tree Shaking**: 更好的死代码消除
- ✅ **静态分析**: 编译时优化
- ✅ **浏览器兼容**: 可以在浏览器中直接运行
- ✅ **Future-proof**: 为未来 Node.js 版本做准备

### 与 CommonJS 对比
| 特性 | CommonJS | ESM |
|------|----------|-----|
| 导入 | `require()` | `import` |
| 导出 | `module.exports` | `export` |
| 同步 | ✅ | ❌ (异步) |
| 静态分析 | ❌ | ✅ |
| 浏览器 | ❌ | ✅ |

## 📚 参考资料

- [Node.js ESM 文档](https://nodejs.org/api/esm.html)
- [ES Module 最佳实践](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [从 CommonJS 迁移到 ESM](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html)

## ✅ 验证转换

运行以下命令验证转换是否成功：

```bash
# 1. 检查 package.json
cat package.json | grep type

# 2. 测试快速检测
npm run analyze:quick

# 3. 测试完整分析
npm run analyze

# 4. 检查生成的报告
ls -lh performance/*-report.json
```

如果所有命令都正常运行，说明 ESM 转换成功！🎉
