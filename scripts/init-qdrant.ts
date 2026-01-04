/**
 * Qdrant 集合初始化脚本
 * 用于手动初始化 Qdrant 向量数据库集合
 * 
 * 使用方法：
 *   pnpm run qdrant:init
 */

// 使用相对路径导入
import { initQdrantCollection } from '../src/lib/qdrant';

async function main() {
  console.log('🚀 开始初始化 Qdrant 集合...\n');

  // 检查环境变量
  if (!process.env.QDRANT_URL) {
    console.error('❌ 错误: QDRANT_URL 环境变量未设置');
    console.log('\n请在 .env 文件中配置:');
    console.log('  QDRANT_URL=http://localhost:6333');
    console.log('  QDRANT_API_KEY=your-api-key  # 可选，如果启用了鉴权\n');
    process.exit(1);
  }

  try {
    await initQdrantCollection();
    console.log('\n✅ Qdrant 集合初始化成功！');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Qdrant 集合初始化失败:', error);
    if (error instanceof Error) {
      console.error('错误详情:', error.message);
    }
    process.exit(1);
  }
}

main();
