/**
 * AI文本处理服务 - 客户端工具
 * 注意：Anthropic SDK 调用在 API 路由中处理，避免浏览器端暴露密钥
 * 默认使用流式响应
 */

/**
 * AI处理操作类型
 */
export type AIActionType = 'refine' | 'expand' | 'summarize';

/**
 * AI提示词模板
 */
export const AI_PROMPTS: Record<AIActionType, string> = {
  refine: '请润色以下文本，保持原意但提升表达质量，使用中文回复：',
  expand: '请扩写以下文本，增加细节和描述，保持原风格，使用中文回复：',
  summarize: '请缩写以下文本，保留核心信息，精简表达，使用中文回复：',
};

/**
 * AI处理参数
 */
export interface AIProcessParams {
  text: string;
  action: AIActionType;
  context?: string;
}

/**
 * AI处理结果
 */
export interface AIProcessResult {
  success: boolean;
  data?: string;
  error?: string;
}

/**
 * 获取AI操作的显示名称
 * @param action 操作类型
 * @returns 显示名称
 */
export const getAIActionLabel = (action: AIActionType): string => {
  const labels: Record<AIActionType, string> = {
    refine: 'AI润色',
    expand: 'AI扩写',
    summarize: 'AI缩写',
  };
  return labels[action];
};

/**
 * 获取AI操作的图标
 * @param action 操作类型
 * @returns 图标名称（Ant Design）
 */
export const getAIActionIcon = (action: AIActionType): string => {
  const icons: Record<AIActionType, string> = {
    refine: 'EditOutlined',
    expand: 'ExpandOutlined',
    summarize: 'CompressOutlined',
  };
  return icons[action];
};

/**
 * 验证文本是否适合AI处理
 * @param text 待验证文本
 * @returns 是否适合
 */
export const validateTextForAI = (text: string): { valid: boolean; reason?: string } => {
  if (!text || text.trim().length === 0) {
    return { valid: false, reason: '文本不能为空' };
  }
  
  if (text.length > 5000) {
    return { valid: false, reason: '文本长度超过5000字符' };
  }
  
  if (text.length < 5) {
    return { valid: false, reason: '文本过短，至少需要5个字符' };
  }
  
  return { valid: true };
};

/**
 * 调用AI处理API（流式）
 * @param params 处理参数
 * @returns Response 对象用于流式读取
 */
export const callAIAPI = async (
  params: AIProcessParams
): Promise<Response> => {
  try {
    const response = await fetch('/api/ai/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response;
  } catch (error) {
    console.error('API调用失败:', error);
    throw error;
  }
};
