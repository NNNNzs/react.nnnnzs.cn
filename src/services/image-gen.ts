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
