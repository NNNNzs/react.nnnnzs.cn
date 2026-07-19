import { getAIConfigCandidates, type AIConfig } from '@/lib/ai-config';

const VALID_MODES = ['generate', 'edit'] as const;
const VALID_API_MODES = ['chat_completions', 'images_generations'] as const;
const IMAGE_URL_REGEX = /!\[image\]\((https?:\/\/[^\s)]+)\)/;
const MAX_EDIT_IMAGES = 10;

type ImageGenApiMode = typeof VALID_API_MODES[number];

export interface ImageGenOptions {
  mode: 'generate' | 'edit';
  prompt: string;
  image?: string;
  images?: string[];
}

export interface ImageGenResult {
  imageUrl: string;
  model: string;
  b64Json?: string;
}

export function normalizeImageInputs(options: Pick<ImageGenOptions, 'image' | 'images'>): string[] {
  const images = [
    ...(Array.isArray(options.images) ? options.images : []),
    ...(options.image ? options.image.split(/\r?\n/) : []),
  ]
    .map((value) => String(value).trim())
    .filter(Boolean);

  return Array.from(new Set(images));
}

export function validateImageGenOptions(options: ImageGenOptions): void {
  if (!VALID_MODES.includes(options.mode)) {
    throw new Error('无效的模式，仅支持 generate 或 edit');
  }
  if (!options.prompt?.trim()) {
    throw new Error('提示词不能为空');
  }
  const imageInputs = normalizeImageInputs(options);
  if (options.mode === 'edit' && imageInputs.length === 0) {
    throw new Error('编辑模式需要提供参考图片');
  }
  if (options.mode === 'edit' && imageInputs.length > MAX_EDIT_IMAGES) {
    throw new Error(`编辑模式最多支持 ${MAX_EDIT_IMAGES} 张参考图片`);
  }
}

function resolveApiMode(value: string | null): ImageGenApiMode {
  const apiMode = value || 'chat_completions';
  if (!VALID_API_MODES.includes(apiMode as ImageGenApiMode)) {
    throw new Error(`不支持的图片生成接口模式: ${apiMode}，可选: ${VALID_API_MODES.join(', ')}`);
  }
  return apiMode as ImageGenApiMode;
}

function createAuthHeaders(apiKey: string): HeadersInit {
  return {
    'Authorization': `Bearer ${apiKey}`,
  };
}

function createJsonHeaders(apiKey: string): HeadersInit {
  return {
    ...createAuthHeaders(apiKey),
    'Content-Type': 'application/json',
  };
}

function getExtnameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').filter(Boolean).pop() || '';
    const dotIndex = filename.lastIndexOf('.');
    return dotIndex > 0 ? filename.slice(dotIndex).toLowerCase() : '';
  } catch {
    return '';
  }
}

function inferImageType(input: string, contentType = '') {
  const lowerContentType = contentType.toLowerCase();
  const ext = getExtnameFromUrl(input);

  if (lowerContentType.includes('jpeg') || lowerContentType.includes('jpg') || ext === '.jpg' || ext === '.jpeg') {
    return { mimeType: 'image/jpeg', ext: '.jpg' };
  }
  if (lowerContentType.includes('webp') || ext === '.webp') {
    return { mimeType: 'image/webp', ext: '.webp' };
  }

  return { mimeType: 'image/png', ext: '.png' };
}

async function imageInputToBlob(input: string, index: number): Promise<{ blob: Blob; filename: string }> {
  if (input.startsWith('data:')) {
    const match = input.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
    if (!match) {
      throw new Error(`第 ${index + 1} 张参考图 data URL 格式无效`);
    }

    const mimeType = match[1] || 'image/png';
    const isBase64 = Boolean(match[2]);
    const payload = match[3] || '';
    const buffer = isBase64
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload));
    const { ext } = inferImageType(input, mimeType);

    return {
      blob: new Blob([buffer], { type: mimeType }),
      filename: `reference-${index + 1}${ext}`,
    };
  }

  const response = await fetch(input, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BlogBot/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`下载第 ${index + 1} 张参考图失败 (${response.status}): ${input.slice(0, 200)}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const { mimeType, ext } = inferImageType(input, contentType);
  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    blob: new Blob([buffer], { type: mimeType }),
    filename: `reference-${index + 1}${ext}`,
  };
}

function parseImageApiResult(result: unknown, model: string, context: Record<string, unknown>): ImageGenResult {
  const imageData = (result as { data?: Array<{ url?: unknown; b64_json?: unknown }> })?.data?.[0];
  const imageUrl = typeof imageData?.url === 'string' ? imageData.url : undefined;
  const b64Json = typeof imageData?.b64_json === 'string' ? imageData.b64_json : undefined;

  if (imageUrl) {
    return { imageUrl, model };
  }

  if (b64Json) {
    return {
      imageUrl: `data:image/png;base64,${b64Json}`,
      model,
      b64Json,
    };
  }

  console.error('图片生成 Image API 返回格式异常:', {
    ...context,
    responseKeys: result && typeof result === 'object' ? Object.keys(result) : [],
    firstDataKeys: imageData && typeof imageData === 'object' ? Object.keys(imageData) : [],
  });
  throw new Error('API 返回数据异常，未包含图片 URL 或 base64 数据');
}

async function requestChatCompletions(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  options: ImageGenOptions;
}): Promise<ImageGenResult> {
  const { apiKey, baseUrl, model, options } = params;
  const { mode, prompt } = options;
  const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

  if (mode === 'edit') {
    const imageInputs = normalizeImageInputs(options);
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: prompt.trim() },
        ...imageInputs.map((url) => ({ type: 'image_url', image_url: { url } })),
      ],
    });
  } else {
    messages.push({ role: 'user', content: prompt.trim() });
  }

  const requestBody: Record<string, unknown> = { model, messages };

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: createJsonHeaders(apiKey),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const detail = JSON.stringify({
      endpoint,
      status: response.status,
      model,
      mode,
      response: errorText.slice(0, 1000),
    });
    console.error('图片生成 chat_completions 调用失败:', detail);
    throw new Error(`chat_completions 调用失败 (${response.status}): ${detail}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content || '';

  const imageUrlMatch = content.match(IMAGE_URL_REGEX);
  if (!imageUrlMatch) {
    console.error('图片生成 chat_completions 返回格式异常:', {
      endpoint,
      model,
      mode,
      content: String(content).slice(0, 1000),
    });
    throw new Error('API 返回数据异常，未包含图片');
  }

  return { imageUrl: imageUrlMatch[1], model };
}

async function requestImagesGenerations(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  options: ImageGenOptions;
}): Promise<ImageGenResult> {
  const { apiKey, baseUrl, model, options } = params;
  const { prompt } = options;

  const requestBody: Record<string, unknown> = {
    model,
    prompt: prompt.trim(),
    n: 1,
  };


  const endpoint = `${baseUrl.replace(/\/+$/, '')}/images/generations`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: createJsonHeaders(apiKey),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const detail = JSON.stringify({
      endpoint,
      status: response.status,
      model,
      response: errorText.slice(0, 1000),
    });
    console.error('图片生成 images_generations 调用失败:', detail);
    throw new Error(`images_generations 调用失败 (${response.status}): ${detail}`);
  }

  const result = await response.json();
  return parseImageApiResult(result, model, {
    endpoint,
    model,
  });
}

async function requestImagesEdits(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  options: ImageGenOptions;
}): Promise<ImageGenResult> {
  const { apiKey, baseUrl, model, options } = params;
  const { prompt } = options;
  const imageInputs = normalizeImageInputs(options);
  const formData = new FormData();

  formData.set('model', model);
  formData.set('prompt', prompt.trim());

  const blobs = await Promise.all(
    imageInputs.map((input, index) => imageInputToBlob(input, index)),
  );

  for (const item of blobs) {
    formData.append('image[]', item.blob, item.filename);
  }

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/images/edits`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: createAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const detail = JSON.stringify({
      endpoint,
      status: response.status,
      model,
      imageCount: imageInputs.length,
      response: errorText.slice(0, 1000),
    });
    console.error('图片编辑 images_edits 调用失败:', detail);
    throw new Error(`images_edits 调用失败 (${response.status}): ${detail}`);
  }

  const result = await response.json();
  return parseImageApiResult(result, model, {
    endpoint,
    model,
    imageCount: imageInputs.length,
  });
}

/**
 * 调用 AI 生成图片（核心逻辑，不含转存和日志）
 */
export async function generateImage(options: ImageGenOptions): Promise<ImageGenResult> {
  validateImageGenOptions(options);

  const configs = await getAIConfigCandidates('image_gen');
  let lastError: unknown = null;

  for (const [index, config] of configs.entries()) {
    const apiKey = config.api_key;
    const baseUrl = config.base_url;
    const model = config.model || 'gpt-image-2';
    const apiMode = resolveApiMode(config.api_mode ?? null);

    try {
      if (apiMode === 'images_generations') {
        return options.mode === 'edit'
          ? await requestImagesEdits({ apiKey, baseUrl, model, options })
          : await requestImagesGenerations({ apiKey, baseUrl, model, options });
      }

      return await requestChatCompletions({ apiKey, baseUrl, model, options });
    } catch (error) {
      lastError = error;
      const hasFallback = index < configs.length - 1;
      const logPayload: Pick<AIConfig, 'base_url' | 'model' | 'api_mode'> = {
        base_url: baseUrl,
        model,
        api_mode: apiMode,
      };

      if (hasFallback) {
        console.warn('图片生成配置调用失败，尝试降级配置:', logPayload, error);
      } else {
        console.error('图片生成所有配置均调用失败:', logPayload, error);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('图片生成失败');
}

export async function uploadGeneratedImageToCDN(
  result: ImageGenResult,
  options: { key?: string } = {},
): Promise<string> {
  const { proxyBase64ImageToCDN, proxyImageToCDN } = await import('./image-proxy');
  return result.b64Json
    ? proxyBase64ImageToCDN(result.b64Json, '.png', { key: options.key })
    : proxyImageToCDN(result.imageUrl, { key: options.key });
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
  const editImageUrls = normalizeImageInputs(options);

  try {
    // 1. 调用 AI 生成图片
    const result = await generateImage(options);
    const durationMs = Date.now() - startTime;

    // 2. 转存到 CDN
    let cdnUrl: string | undefined;
    try {
      cdnUrl = await uploadGeneratedImageToCDN(result);
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
      editImageUrl: options.mode === 'edit' ? editImageUrls[0] : undefined,
      editImageUrls: options.mode === 'edit' ? editImageUrls : undefined,
      model: result.model,
      originalUrl: result.b64Json ? 'b64_json' : result.imageUrl,
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

    console.error('图片生成失败:', {
      userId,
      source,
      mode: options.mode,
      promptLength: options.prompt?.length ?? 0,
      hasImage: Boolean(options.image),
      errorMessage,
      durationMs,
    });

    throw error;
  }
}
