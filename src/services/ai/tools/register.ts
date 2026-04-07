/**
 * 工具注册入口
 * 注册所有可用的 AI 工具到全局工具注册表
 */

import { toolRegistry } from './index';
import { searchArticlesTool } from './search-articles';
import { searchPostsMetaTool } from './search-posts-meta';
import { searchCollectionTool } from './search-collection';

/**
 * 注册所有工具
 * 在应用启动时调用一次即可
 */
export function registerAllTools(): void {
  // 注册文章语义搜索工具（向量相似度，理解问题意图）
  toolRegistry.register(searchArticlesTool);
  // 注册文章元数据查询工具（按时间、热度、分类等维度查询）
  toolRegistry.register(searchPostsMetaTool);
  // 注册合集搜索工具
  toolRegistry.register(searchCollectionTool);

  console.log('✅ 所有 AI 工具注册完成');
}

// 自动注册工具（模块加载时执行）
registerAllTools();
