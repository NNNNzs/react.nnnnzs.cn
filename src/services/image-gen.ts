import { getAIConfigValues } from '@/lib/ai-config';

const VALID_MODES = ['generate', 'edit'] as const;
const VALID_QUALITIES = ['high', 'medium'] as const;
const IMAGE_URL_REGEX = /!\[image\]\((https?:\/\/[^\s)]+)\)/;

export interface ImageGenOptions {
  mode: 'generate' | 'edit';
  prompt: string;
  image?: string;
  size?: string;
  quality?: string;
}

export interface ImageGenResult {
  imageUrl: string;
  model: string;
}

function validateOptions(options: ImageGenOptions): void {
  if (!VALID_MODES.includes(options.mode)) {
    throw new Error('无效的模式，仅支持 generate 或 edit');
  }
  if (!options.prompt?.trim()) {
    throw new Error('提示词不能为空');
  }
  if (options.mode === 'edit' && !options.image?.trim()) {
    throw new Error('编辑模式需要提供参考图片');
  }
  if (options.size && !/^\d+x\d+$/.test(options.size)) {
    throw new Error('尺寸格式错误，应为 宽x高，如 1024x1024');
  }
  if (options.quality && !VALID_QUALITIES.includes(options.quality as typeof VALID_QUALITIES[number])) {
    throw new Error(`不支持的质量: ${options.quality}，可选: ${VALID_QUALITIES.join(', ')}`);
  }
}

/**
 * 调用 AI 生成图片（核心逻辑，不含转存和日志）
 */
export async function generateImage(options: ImageGenOptions): Promise<ImageGenResult> {
  validateOptions(options);

  const { mode, prompt, image, size, quality } = options;

  const configs = await getAIConfigValues([
    'image_gen.api_key',
    'image_gen.base_url',
    'image_gen.model',
  ]);

  const apiKey = configs['image_gen.api_key'];
  const baseUrl = configs['image_gen.base_url'];
  const model = configs['image_gen.model'] || 'gpt-image-2';

  if (!apiKey) throw new Error('图片生成 API 密钥未配置，请在配置管理中设置 image_gen.api_key');
  if (!baseUrl) throw new Error('图片生成 API 地址未配置，请在配置管理中设置 image_gen.base_url');

  const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

  if (mode === 'edit') {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: prompt.trim() },
        { type: 'image_url', image_url: { url: image!.trim() } },
      ],
    });
  } else {
    messages.push({ role: 'user', content: prompt.trim() });
  }

  const requestBody: Record<string, unknown> = { model, messages };

  if (size || quality) {
    const hints: string[] = [];
    if (size) hints.push(`size: ${size}`);
    if (quality) hints.push(`quality: ${quality}`);
    const currentMessages = messages as Array<{ role: string; content: string }>;
    requestBody.messages = [
      { role: 'system', content: `Generate image with the following constraints: ${hints.join(', ')}` },
      ...currentMessages,
    ];
  }

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 调用失败 (${response.status}): ${errorText.slice(0, 500)}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content || '';

  const imageUrlMatch = content.match(IMAGE_URL_REGEX);
  if (!imageUrlMatch) {
    throw new Error('API 返回数据异常，未包含图片');
  }

  return { imageUrl: imageUrlMatch[1], model };
}

/**
 * 生成图片 + 转存到 CDN + 写日志（完整流程）
 *
 * @param options 生成参数
 * @param userId 操作用户ID
 * @param source 来源：ADMIN / MCP
 * @returns 最终结果（CDN URL 或原始 URL）
 */
export async function generateImageWithLog(
  options: ImageGenOptions,
  userId: number,
  source: 'ADMIN' | 'MCP' = 'ADMIN',
): Promise<ImageGenResult & { cdnUrl?: string }> {
  const startTime = Date.now();
  const { createImageGenLog } = await import('./image-gen-log');

  try {
    // 1. 调用 AI 生成图片
    const result = await generateImage(options);
    const durationMs = Date.now() - startTime;

    // 2. 转存到 CDN
    let cdnUrl: string | undefined;
    try {
      const { proxyImageToCDN } = await import('./image-proxy');
      cdnUrl = await proxyImageToCDN(result.imageUrl);
    } catch (proxyError) {
      console.error('图片转存失败，使用原始URL:', proxyError);
      // 转存失败不影响主流程，使用原始 URL
    }

    // 3. 写日志（异步，不阻塞返回）
    createImageGenLog({
      userId,
      source,
      prompt: options.prompt,
      editPrompt: options.mode === 'edit' ? options.prompt : undefined,
      editImageUrl: options.mode === 'edit' ? options.image : undefined,
      model: result.model,
      originalUrl: result.imageUrl,
      cdnUrl,
      status: 'SUCCESS',
      durationMs,
    }).catch((err) => console.error('写入图片生成日志失败:', err));

    return {
      imageUrl: cdnUrl || result.imageUrl,
      model: result.model,
      cdnUrl,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : '图片生成失败';

    // 写失败日志
    createImageGenLog({
      userId,
      source,
      prompt: options.prompt,
      editPrompt: options.mode === 'edit' ? options.prompt : undefined,
      editImageUrl: options.mode === 'edit' ? options.image : undefined,
      model: 'unknown',
      originalUrl: '',
      status: 'FAILED',
      errorMessage,
      durationMs,
    }).catch((err) => console.error('写入图片生成日志失败:', err));

    throw error;
  }
}
