/**
 * AI 服务统一导出
 * 提供所有 AI 相关服务的核心接口
 */

// AI 文本处理服务
export { processAITextStream } from './text';

// 文章描述生成服务
export { generDescriptionStream } from './description';

// 工具函数（按需导出）
export { 
  createBasePrompt, 
  createPromptWithContext, 
  createChineseSystemInstruction 
} from './utils/prompt';
