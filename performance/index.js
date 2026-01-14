#!/usr/bin/env node

/**
 * 🚀 React 项目性能检测工具集 (ESM 版本)
 *
 * 使用方法:
 *   npm run analyze          # 运行所有性能检测
 *   npm run analyze:code     # 代码质量分析
 *   npm run analyze:bundle   # 包大小分析
 *   npm run analyze:render   # 渲染性能分析
 *   npm run analyze:quick    # 快速检测
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printHeader(title) {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log('='.repeat(80) + '\n');
}

// 检查是否在项目根目录
function checkProjectRoot() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    log('❌ 请在项目根目录运行此命令', 'red');
    process.exit(1);
  }
}

// 运行分析脚本
function runAnalysis(scriptName, description) {
  const scriptPath = path.join(__dirname, scriptName);
  if (!fs.existsSync(scriptPath)) {
    log(`⚠️  ${description} 跳过 (文件不存在)`, 'yellow');
    return;
  }

  log(`🔍 ${description}...`, 'blue');
  try {
    execSync(`node ${scriptPath}`, { stdio: 'inherit' });
    log(`✅ ${description} 完成`, 'green');
  } catch (error) {
    log(`❌ ${description} 失败`, 'red');
    console.error(error.message);
  }
}

// 生成汇总报告
function generateSummaryReport() {
  const reports = [
    { file: 'code-analysis-report.json', name: '代码质量' },
    { file: 'bundle-analysis-report.json', name: '包大小' },
    { file: 'rendering-analysis-report.json', name: '渲染性能' }
  ];

  const summary = {
    timestamp: new Date().toISOString(),
    project: path.basename(process.cwd()),
    overallScore: 0,
    issues: [],
    recommendations: []
  };

  let totalScore = 0;
  let scoreCount = 0;

  reports.forEach(report => {
    const reportPath = path.join(__dirname, report.file);
    if (fs.existsSync(reportPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

        if (data.score) {
          totalScore += data.score;
          scoreCount++;
        }

        // 收集严重问题
        if (data.issues) {
          const highSeverity = data.issues.filter(i => i.severity === 'high');
          if (highSeverity.length > 0) {
            summary.issues.push({
              category: report.name,
              count: highSeverity.length,
              items: highSeverity.slice(0, 3) // 只取前3个
            });
          }
        }

        // 收集建议
        if (data.suggestions) {
          summary.recommendations.push({
            category: report.name,
            items: data.suggestions
          });
        }
      } catch (e) {
        console.error(`读取 ${report.file} 失败:`, e.message);
      }
    }
  });

  summary.overallScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

  // 保存汇总报告
  const summaryPath = path.join(__dirname, 'summary-report.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  // 打印汇总
  printHeader('📊 综合性能报告');

  console.log(`项目: ${colors.bright}${summary.project}${colors.reset}`);
  console.log(`时间: ${new Date().toLocaleString()}`);
  console.log(`综合评分: ${colors.bright}${summary.overallScore}/100${colors.reset}`);

  if (summary.issues.length > 0) {
    console.log('\n🚨 严重问题汇总:');
    summary.issues.forEach(item => {
      console.log(`\n  ${colors.yellow}${item.category}${colors.reset} (${item.count}个):`);
      item.items.forEach(issue => {
        const file = issue.file ? issue.file.replace(process.cwd(), '') : '';
        console.log(`    - ${issue.issue}${file ? ` (${file})` : ''}`);
      });
    });
  }

  if (summary.recommendations.length > 0) {
    console.log('\n💡 优化建议:');
    summary.recommendations.forEach(item => {
      console.log(`\n  ${colors.cyan}${item.category}${colors.reset}:`);
      item.items.forEach((rec, i) => {
        if (typeof rec === 'string') {
          console.log(`    ${i + 1}. ${rec}`);
        } else if (rec.items) {
          console.log(`    ${rec.category}:`);
          rec.items.forEach(sub => console.log(`      - ${sub}`));
        }
      });
    });
  }

  console.log(`\n✅ 详细报告已保存到: ${summaryPath}`);
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  checkProjectRoot();

  // 确保 performance 目录存在
  if (!fs.existsSync(__dirname)) {
    log('❌ performance 目录不存在', 'red');
    process.exit(1);
  }

  switch (command) {
    case 'code':
      printHeader('🔍 代码质量分析');
      runAnalysis('analyze-performance.js', '代码质量检测');
      break;

    case 'bundle':
      printHeader('📦 包大小分析');
      runAnalysis('check-bundle.js', '包大小检测');
      break;

    case 'render':
      printHeader('⚡ 渲染性能分析');
      runAnalysis('analyze-rendering.js', '渲染性能检测');
      break;

    case 'quick':
      printHeader('⚡ 快速性能检测');
      runAnalysis('analyze-performance.js', '代码质量检测');
      break;

    case 'all':
    default:
      printHeader('🚀 完整性能分析套件');

      // 运行所有检测
      runAnalysis('analyze-performance.js', '代码质量分析');
      runAnalysis('check-bundle.js', '包大小分析');
      runAnalysis('analyze-rendering.js', '渲染性能分析');

      // 生成汇总报告
      setTimeout(() => {
        generateSummaryReport();
      }, 1000);
      break;
  }
}

// 导出函数供其他模块使用
export {
  runAnalysis,
  generateSummaryReport,
  checkProjectRoot
};

// 直接运行时执行 main
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
