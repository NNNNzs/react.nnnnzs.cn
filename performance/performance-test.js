/**
 * 性能测试脚本
 * 使用 Playwright 进行 Lighthouse 性能分析
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 性能测试配置
const TEST_CONFIG = {
  url: 'http://localhost:3000',
  iterations: 3,
  warmupRuns: 1,
  timeout: 30000
};

// 性能指标收集器
class PerformanceCollector {
  constructor() {
    this.metrics = {
      navigation: [],
      resources: [],
      paint: [],
      memory: [],
      cpu: []
    };
  }

  async collectMetrics(page) {
    // 收集性能时间戳
    const performanceMetrics = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      const resources = performance.getEntriesByType('resource');

      return {
        navigation: perf ? {
          dns: perf.domainLookupEnd - perf.domainLookupStart,
          tcp: perf.connectEnd - perf.connectStart,
          ttfb: perf.responseStart - perf.requestStart,
          download: perf.responseEnd - perf.responseStart,
          domReady: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
          load: perf.loadEventEnd - perf.loadEventStart,
          total: perf.duration
        } : null,
        paint: paint.reduce((acc, entry) => {
          acc[entry.name] = entry.startTime;
          return acc;
        }, {}),
        resources: resources.length,
        jsHeap: performance.memory ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        } : null
      };
    });

    // 收集网络信息
    const client = await page.context().newCDPSession(page);
    const browserMetrics = await client.send('Performance.getMetrics');

    return {
      ...performanceMetrics,
      browser: browserMetrics
    };
  }

  async analyzeBundle(page) {
    return await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      const bundles = entries.filter(e =>
        e.name.includes('.js') || e.name.includes('.css')
      );

      return bundles.map(b => ({
        name: b.name.split('/').pop(),
        size: b.transferSize,
        duration: b.duration
      }));
    });
  }
}

// 运行性能测试
async function runPerformanceTest() {
  console.log('🚀 开始性能测试...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const collector = new PerformanceCollector();
  const results = [];

  try {
    // 预热
    console.log('🔥 预热中...');
    const warmupPage = await browser.newPage();
    await warmupPage.goto(TEST_CONFIG.url, { waitUntil: 'networkidle' });
    await warmupPage.close();

    // 正式测试
    for (let i = 0; i < TEST_CONFIG.iterations; i++) {
      console.log(`📊 第 ${i + 1}/${TEST_CONFIG.iterations} 次测试...`);

      const page = await browser.newPage();

      // 启用性能追踪
      await page.tracing.start({
        path: `trace-${i + 1}.json`,
        screenshots: false,
        categories: ['devtools.timeline', 'blink.user_timing']
      });

      // 记录开始时间
      const startTime = Date.now();

      // 导航并等待加载
      await page.goto(TEST_CONFIG.url, {
        waitUntil: 'networkidle',
        timeout: TEST_CONFIG.timeout
      });

      // 收集性能数据
      const metrics = await collector.collectMetrics(page);
      const bundleAnalysis = await collector.analyzeBundle(page);

      // 记录结束时间
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      await page.tracing.stop();

      results.push({
        iteration: i + 1,
        totalTime,
        metrics,
        bundleAnalysis
      });

      await page.close();

      console.log(`  ✅ 完成 - 总耗时: ${totalTime}ms`);
    }

  } finally {
    await browser.close();
  }

  return results;
}

// 分析结果
function analyzeResults(results) {
  console.log('\n📈 性能分析结果\n');
  console.log('='.repeat(80));

  // 计算平均值
  const avgTime = results.reduce((sum, r) => sum + r.totalTime, 0) / results.length;

  // 提取所有导航指标
  const navMetrics = results
    .map(r => r.metrics.navigation)
    .filter(Boolean);

  const avgNavigation = {
    dns: navMetrics.reduce((sum, m) => sum + m.dns, 0) / navMetrics.length,
    tcp: navMetrics.reduce((sum, m) => sum + m.tcp, 0) / navMetrics.length,
    ttfb: navMetrics.reduce((sum, m) => sum + m.ttfb, 0) / navMetrics.length,
    download: navMetrics.reduce((sum, m) => sum + m.download, 0) / navMetrics.length,
    domReady: navMetrics.reduce((sum, m) => sum + m.domReady, 0) / navMetrics.length,
    load: navMetrics.reduce((sum, m) => sum + m.load, 0) / navMetrics.length,
    total: navMetrics.reduce((sum, m) => sum + m.total, 0) / navMetrics.length
  };

  // 提取所有 Paint 指标
  const paintMetrics = results
    .map(r => r.metrics.paint)
    .filter(Boolean);

  const avgPaint = {
    'first-paint': paintMetrics.reduce((sum, m) => sum + (m['first-paint'] || 0), 0) / paintMetrics.length,
    'first-contentful-paint': paintMetrics.reduce((sum, m) => sum + (m['first-contentful-paint'] || 0), 0) / paintMetrics.length
  };

  // 提取所有 JS Heap 指标
  const heapMetrics = results
    .map(r => r.metrics.browser?.jsHeap)
    .filter(Boolean);

  const avgHeap = heapMetrics.length > 0 ? {
    used: heapMetrics.reduce((sum, m) => sum + m.used, 0) / heapMetrics.length,
    total: heapMetrics.reduce((sum, m) => sum + m.total, 0) / heapMetrics.length
  } : null;

  // 分析资源大小
  const allBundles = results.flatMap(r => r.bundleAnalysis || []);
  const bundleGroups = {};

  allBundles.forEach(bundle => {
    if (!bundleGroups[bundle.name]) {
      bundleGroups[bundle.name] = { count: 0, totalSize: 0, totalDuration: 0 };
    }
    bundleGroups[bundle.name].count++;
    bundleGroups[bundle.name].totalSize += bundle.size;
    bundleGroups[bundle.name].totalDuration += bundle.duration;
  });

  // 输出结果
  console.log('\n📊 核心性能指标:');
  console.log(`  平均加载时间: ${avgTime.toFixed(2)}ms`);
  console.log(`  平均总导航时间: ${avgNavigation.total.toFixed(2)}ms`);
  console.log(`  DNS 查询: ${avgNavigation.dns.toFixed(2)}ms`);
  console.log(`  TCP 连接: ${avgNavigation.tcp.toFixed(2)}ms`);
  console.log(`  TTFB (首字节): ${avgNavigation.ttfb.toFixed(2)}ms`);
  console.log(`  下载时间: ${avgNavigation.download.toFixed(2)}ms`);
  console.log(`  DOM Ready: ${avgNavigation.domReady.toFixed(2)}ms`);
  console.log(`  Load 完成: ${avgNavigation.load.toFixed(2)}ms`);

  console.log('\n🎨 渲染性能:');
  console.log(`  First Paint: ${avgPaint['first-paint']?.toFixed(2)}ms`);
  console.log(`  First Contentful Paint: ${avgPaint['first-contentful-paint']?.toFixed(2)}ms`);

  if (avgHeap) {
    console.log('\n🧠 内存使用:');
    console.log(`  JS Heap Used: ${(avgHeap.used / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  JS Heap Total: ${(avgHeap.total / 1024 / 1024).toFixed(2)}MB`);
  }

  console.log('\n📦 资源分析 (Top 10):');
  const sortedBundles = Object.entries(bundleGroups)
    .sort((a, b) => b[1].totalSize - a[1].totalSize)
    .slice(0, 10);

  sortedBundles.forEach(([name, stats]) => {
    const avgSize = stats.totalSize / stats.count;
    const avgDuration = stats.totalDuration / stats.count;
    console.log(`  ${name}: ${(avgSize / 1024).toFixed(2)}KB, ${avgDuration.toFixed(2)}ms`);
  });

  // 性能评分
  console.log('\n🏆 性能评分:');
  let score = 100;

  if (avgTime > 3000) score -= 20;
  else if (avgTime > 1500) score -= 10;

  if (avgPaint['first-contentful-paint'] > 1800) score -= 15;
  else if (avgPaint['first-contentful-paint'] > 1000) score -= 5;

  if (avgNavigation.ttfb > 600) score -= 10;

  if (avgHeap && avgHeap.used > 50 * 1024 * 1024) score -= 10;

  console.log(`  综合评分: ${Math.max(0, score)}/100`);

  if (score >= 90) console.log('  等级: ⭐⭐⭐⭐⭐ 优秀');
  else if (score >= 75) console.log('  等级: ⭐⭐⭐⭐ 良好');
  else if (score >= 50) console.log('  等级: ⭐⭐⭐ 一般');
  else console.log('  等级: ⭐⭐ 需要优化');

  return {
    avgTime,
    avgNavigation,
    avgPaint,
    avgHeap,
    bundleGroups,
    score
  };
}

// 主函数
async function main() {
  try {
    const results = await runPerformanceTest();
    const analysis = analyzeResults(results);

    // 保存结果到文件
    const report = {
      timestamp: new Date().toISOString(),
      results,
      analysis
    };

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    fs.writeFileSync(
      path.join(__dirname, 'performance-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n✅ 详细报告已保存到 performance-report.json');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 检查是否安装了 playwright
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runPerformanceTest, analyzeResults };
