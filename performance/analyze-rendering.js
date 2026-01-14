/**
 * 渲染性能分析脚本 (ESM 版本)
 * 分析 React 组件的渲染性能问题
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 需要扫描的目录
const SRC_DIR = path.join(__dirname, '..', 'src');

// 渲染性能分析器
class RenderingAnalyzer {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.stats = {
      components: 0,
      useMemo: 0,
      useCallback: 0,
      memo: 0,
      propDrilling: 0,
      largeContexts: 0
    };
  }

  // 分析单个文件
  analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // 统计组件数量 (简单统计: 包含 export default 或 export function)
    const componentMatches = content.match(/export\s+(default\s+)?(function|const)\s+\w+/g);
    if (componentMatches) {
      this.stats.components += componentMatches.length;
    }

    // 统计 useMemo 使用
    const useMemoMatches = content.match(/useMemo/g);
    if (useMemoMatches) {
      this.stats.useMemo += useMemoMatches.length;
    }

    // 统计 useCallback 使用
    const useCallbackMatches = content.match(/useCallback/g);
    if (useCallbackMatches) {
      this.stats.useCallback += useCallbackMatches.length;
    }

    // 统计 React.memo 使用
    const memoMatches = content.match(/React\.memo|memo\(/g);
    if (memoMatches) {
      this.stats.memo += memoMatches.length;
    }

    // 检测大型组件 (>200行)
    const linesCount = lines.length;
    if (linesCount > 200) {
      this.issues.push({
        file: filePath,
        issue: '大型组件',
        lines: linesCount,
        severity: 'medium'
      });
    }

    // 检测 Context 包含大量数据
    const contextRegex = /const\s+\w+Context\s*=\s*createContext\(/g;
    if (contextRegex.test(content)) {
      // 检查 Context value 是否复杂
      const contextValueRegex = /value\s*=\s*\{[\s\S]{100,}\}/g;
      if (contextValueRegex.test(content)) {
        this.issues.push({
          file: filePath,
          issue: 'Context 包含大量数据',
          severity: 'high'
        });
        this.stats.largeContexts++;
      }
    }

    // 检测 prop drilling (深层嵌套的 props 传递)
    const propDrillingRegex = /props\.\w+\.\w+\.\w+/g;
    if (propDrillingRegex.test(content)) {
      this.stats.propDrilling++;
      this.warnings.push({
        file: filePath,
        issue: 'Prop drilling 检测',
        severity: 'low'
      });
    }

    // 检测组件未使用 React.memo 优化
    const componentRegex = /export\s+(default\s+)?(function|const)\s+(\w+)/g;
    let match;
    while ((match = componentRegex.exec(content)) !== null) {
      const componentName = match[3];
      // 检查是否被 memo 包裹
      const memoWrapped = new RegExp(`const\\s+${componentName}\\s*=\\s*React\\.memo`, 'g');
      const defaultMemo = new RegExp(`export\\s+default\\s+React\\.memo\\(${componentName}`, 'g');

      if (!memoWrapped.test(content) && !defaultMemo.test(content)) {
        // 检查是否是纯组件 (没有 hooks)
        const hasHooks = /use(State|Effect|Context|Reducer|Ref|Memo|Callback)/.test(content);
        if (!hasHooks && linesCount > 50) {
          this.warnings.push({
            file: filePath,
            issue: '组件未使用 React.memo 优化',
            component: componentName,
            severity: 'medium'
          });
        }
      }
    }

    // 检测 useEffect 中触发状态更新
    const useEffectStateUpdateRegex = /useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?set\w+[\s\S]*?\},\s*\[/g;
    const badEffects = content.match(useEffectStateUpdateRegex);
    if (badEffects && badEffects.length > 0) {
      badEffects.forEach(() => {
        this.warnings.push({
          file: filePath,
          issue: 'useEffect 中触发状态更新',
          severity: 'medium'
        });
      });
    }

    // 检测 Context value 未使用 useMemo 优化
    const contextValueWithoutMemo = /value\s*=\s*\{[\s\S]*?\}/g;
    const contextValues = content.match(contextValueWithoutMemo);
    if (contextValues && contextValues.length > 0) {
      // 检查是否有 useMemo 包裹
      const hasMemo = /value\s*=\s*useMemo/.test(content);
      if (!hasMemo) {
        this.warnings.push({
          file: filePath,
          issue: 'Context value 未使用 useMemo 优化',
          severity: 'medium'
        });
      }
    }

    // 检测列表渲染包含复杂逻辑
    const complexListRegex = /\{\s*\w+\.map\([^}]+\{[\s\S]{50,}\}\)/g;
    if (complexListRegex.test(content)) {
      this.warnings.push({
        file: filePath,
        issue: '列表渲染包含复杂逻辑',
        severity: 'low'
      });
    }
  }

  // 递归扫描目录
  scanDirectory(dir) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!['node_modules', '.next', 'dist', 'build'].includes(item)) {
          this.scanDirectory(fullPath);
        }
      } else if (stat.isFile()) {
        if (['.tsx', '.ts', '.jsx', '.js'].includes(path.extname(item))) {
          this.analyzeFile(fullPath);
        }
      }
    }
  }

  // 生成报告
  generateReport() {
    console.log('\n🎨 渲染性能分析报告\n');
    console.log('='.repeat(80));

    console.log('\n📊 统计信息:');
    console.log(`  组件总数: ${this.stats.components}`);
    console.log(`  useMemo 使用: ${this.stats.useMemo}`);
    console.log(`  useCallback 使用: ${this.stats.useCallback}`);
    console.log(`  React.memo 使用: ${this.stats.memo}`);
    console.log(`  Context 数量: ${this.stats.largeContexts}`);

    if (this.issues.length > 0) {
      console.log('\n❌ 严重渲染问题:');
      this.issues
        .filter(i => i.severity === 'high')
        .forEach(issue => {
          console.log(`  📄 ${issue.file.replace(__dirname, '')}`);
          console.log(`     问题: ${issue.issue}`);
          if (issue.lines) console.log(`     行数: ${issue.lines}`);
        });
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  渲染优化建议:');
      this.warnings
        .filter(w => w.severity === 'medium' || w.severity === 'low')
        .slice(0, 20)
        .forEach(warning => {
          console.log(`  📄 ${warning.file.replace(__dirname, '')}`);
          console.log(`     问题: ${warning.issue}`);
          if (warning.component) console.log(`     组件: ${warning.component}`);
        });

      if (this.warnings.length > 20) {
        console.log(`  ... 还有 ${this.warnings.length - 20} 个警告`);
      }
    }

    // 优化指数评分
    let score = 100;
    if (this.stats.largeContexts > 0) score -= 20;
    if (this.issues.filter(i => i.severity === 'medium').length > 5) score -= 15;
    if (this.warnings.filter(w => w.issue.includes('未使用 React.memo')).length > 5) score -= 10;
    if (this.stats.components > 50 && this.stats.useMemo < 10) score -= 10;

    console.log('\n🏆 优化指数:', `${Math.max(0, score)}/100`);

    // 优化建议
    console.log('\n💡 渲染优化建议:');
    const suggestions = [];

    if (this.stats.largeContexts > 0) {
      suggestions.push('拆分大型 Context，使用多个小 Context');
    }
    if (this.warnings.some(w => w.issue.includes('未使用 React.memo'))) {
      suggestions.push('对纯组件使用 React.memo 包装');
    }
    if (this.stats.useMemo < this.stats.components / 5) {
      suggestions.push('使用 useMemo 优化 Context value 和计算值');
    }
    if (this.warnings.some(w => w.issue.includes('useEffect 中触发状态更新'))) {
      suggestions.push('优化 useEffect 依赖，避免不必要的状态更新');
    }

    suggestions.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s}`);
    });

    return {
      stats: this.stats,
      issues: this.issues,
      warnings: this.warnings,
      score
    };
  }
}

// 运行分析
function main() {
  console.log('🚀 开始分析渲染性能...\n');

  const analyzer = new RenderingAnalyzer();
  analyzer.scanDirectory(SRC_DIR);
  const report = analyzer.generateReport();

  // 保存报告
  const reportPath = path.join(__dirname, 'rendering-analysis-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n✅ 详细报告已保存到 ${reportPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default RenderingAnalyzer;
