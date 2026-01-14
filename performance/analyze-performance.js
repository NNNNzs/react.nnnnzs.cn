/**
 * 代码性能分析脚本 (ESM 版本)
 * 分析源代码中的性能问题
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 需要扫描的目录 (相对于项目根目录)
const SRC_DIR = path.join(__dirname, '..', 'src');

// 性能问题检测器
class PerformanceAnalyzer {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.stats = {
      files: 0,
      useEffect: 0,
      consoleLog: 0,
      largeFiles: 0,
      heavyDependencies: 0
    };
  }

  // 读取并分析文件
  analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    this.stats.files++;

    // 检测 console.log
    const consoleMatches = content.match(/console\.log/g);
    if (consoleMatches) {
      this.stats.consoleLog += consoleMatches.length;
      if (!filePath.includes('dev') && !filePath.includes('test')) {
        this.warnings.push({
          file: filePath,
          issue: '过多的 console.log',
          count: consoleMatches.length,
          line: lines.findIndex(l => l.includes('console.log')) + 1
        });
      }
    }

    // 检测 useEffect 使用
    const useEffectMatches = content.match(/useEffect/g);
    if (useEffectMatches) {
      this.stats.useEffect += useEffectMatches.length;
    }

    // 检测大型文件
    const linesCount = lines.length;
    if (linesCount > 300) {
      this.stats.largeFiles++;
      this.issues.push({
        file: filePath,
        issue: '文件过大',
        details: `${linesCount} 行代码`,
        severity: 'medium'
      });
    }

    // 检测复杂的 useEffect 依赖
    const useEffectRegex = /useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?\},\s*\[(.*?)\]\s*\)/g;
    let match;
    while ((match = useEffectRegex.exec(content)) !== null) {
      const deps = match[1].trim();
      if (deps.length > 50) {
        this.warnings.push({
          file: filePath,
          issue: 'useEffect 依赖数组过长',
          details: deps.substring(0, 100),
          severity: 'low'
        });
      }
    }

    // 检测未使用的变量
    const unusedVarRegex = /const\s+(\w+)\s*=.*;\s*$/m;
    const linesWithUnused = lines.filter(line => {
      const match = line.match(unusedVarRegex);
      if (!match) return false;
      const varName = match[1];
      // 检查变量是否在后续代码中使用
      const regex = new RegExp(`\\b${varName}\\b`, 'g');
      const usageCount = (content.match(regex) || []).length;
      return usageCount === 1; // 只在声明处出现一次
    });

    if (linesWithUnused.length > 0) {
      this.warnings.push({
        file: filePath,
        issue: '未使用的变量',
        count: linesWithUnused.length,
        severity: 'low'
      });
    }

    // 检测重复的 API 调用
    const apiCalls = content.match(/axios\.(get|post|put|delete)/g);
    if (apiCalls && apiCalls.length > 5) {
      this.warnings.push({
        file: filePath,
        issue: '多个 API 调用',
        count: apiCalls.length,
        severity: 'medium'
      });
    }

    // 检测没有依赖数组的 useEffect (可能导致无限循环)
    const badUseEffectRegex = /useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\)(?!\s*,\s*\[)/g;
    const badEffects = content.match(badUseEffectRegex);
    if (badEffects) {
      this.issues.push({
        file: filePath,
        issue: 'useEffect 缺少依赖数组',
        count: badEffects.length,
        severity: 'high'
      });
    }

    // 检测大型对象字面量
    const largeObjectRegex = /const\s+\w+\s*=\s*\{[\s\S]{200,}\}/g;
    if (largeObjectRegex.test(content)) {
      this.warnings.push({
        file: filePath,
        issue: '大型对象字面量',
        severity: 'low'
      });
    }

    // 检测 inline 样式中的复杂计算
    const inlineStyleRegex = /style\s*=\s*\{[\s\S]*?calc\([\s\S]*?\)/g;
    if (inlineStyleRegex.test(content)) {
      this.warnings.push({
        file: filePath,
        issue: '使用 calc() 的内联样式',
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
        // 跳过 node_modules 和 .next
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
    console.log('\n🔍 性能代码分析报告\n');
    console.log('='.repeat(80));

    console.log('\n📊 统计信息:');
    console.log(`  扫描文件数: ${this.stats.files}`);
    console.log(`  useEffect 使用: ${this.stats.useEffect}`);
    console.log(`  console.log 数量: ${this.stats.consoleLog}`);
    console.log(`  大型文件 (>300行): ${this.stats.largeFiles}`);

    if (this.issues.length > 0) {
      console.log('\n❌ 严重问题:');
      this.issues
        .filter(i => i.severity === 'high')
        .forEach(issue => {
          console.log(`  📄 ${issue.file.replace(__dirname, '')}`);
          console.log(`     问题: ${issue.issue}`);
          if (issue.details) console.log(`     详情: ${issue.details}`);
          if (issue.count) console.log(`     数量: ${issue.count}`);
        });
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  需要注意的问题:');
      this.warnings
        .filter(w => w.severity === 'medium' || w.severity === 'low')
        .slice(0, 20) // 只显示前20个
        .forEach(warning => {
          console.log(`  📄 ${warning.file.replace(__dirname, '')}`);
          console.log(`     问题: ${warning.issue}`);
          if (warning.count) console.log(`     数量: ${warning.count}`);
        });

      if (this.warnings.length > 20) {
        console.log(`  ... 还有 ${this.warnings.length - 20} 个警告`);
      }
    }

    // 性能评分
    let score = 100;
    if (this.stats.consoleLog > 10) score -= 10;
    if (this.stats.largeFiles > 3) score -= 15;
    if (this.issues.filter(i => i.severity === 'high').length > 0) score -= 20;
    if (this.stats.useEffect > 30) score -= 10;

    console.log('\n🏆 代码质量评分:', `${Math.max(0, score)}/100`);

    // 优化建议
    console.log('\n💡 优化建议:');
    const suggestions = [];

    if (this.stats.consoleLog > 0) {
      suggestions.push('移除生产环境的 console.log');
    }
    if (this.issues.some(i => i.issue.includes('useEffect 缺少依赖'))) {
      suggestions.push('修复 useEffect 缺少依赖数组的问题');
    }
    if (this.stats.largeFiles > 0) {
      suggestions.push('拆分大型文件，提取组件');
    }
    if (this.warnings.some(w => w.issue.includes('未使用的变量'))) {
      suggestions.push('清理未使用的变量');
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
  console.log('🚀 开始分析代码性能问题...\n');

  const analyzer = new PerformanceAnalyzer();
  analyzer.scanDirectory(SRC_DIR);
  const report = analyzer.generateReport();

  // 保存报告
  const reportPath = path.join(__dirname, 'code-analysis-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n✅ 详细报告已保存到 ${reportPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default PerformanceAnalyzer;
