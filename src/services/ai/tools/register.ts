/**
 * 工具注册入口
 * 注册所有可用的 AI 工具到全局工具注册表
 */

import { toolRegistry } from './index';
import { searchArticlesTool } from './search-articles';

/**
 * 注册所有工具
 * 在应用启动时调用一次即可
 */
export function registerAllTools(): void {
  // 注册文章搜索工具
  toolRegistry.register(searchArticlesTool);
  
  // 未来可以在这里注册更多工具
  // toolRegistry.register(weatherTool);
  // toolRegistry.register(calculatorTool);
  
  console.log('✅ 所有 AI 工具注册完成');
}

// 自动注册工具（模块加载时执行）
registerAllTools();
