import { getAIConfig } from '@/lib/ai-config';

const IMAGE_RECOGNITION_SCENARIO = 'image_recognition';
const DEFAULT_IMAGE_RECOGNITION_PROMPT = '请详细描述这张图片的内容';
const DEFAULT_MAX_TOKENS = 800;
const MAX_PROMPT_LENGTH = 4000;
const MAX_BASE64_LENGTH = 20 * 1024 * 1024;
const VALID_IMAGE_DETAILS = ['low', 'high', 'auto'] as const;
const SUPPORTED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export type ImageRecognitionDetail = typeof VALID_IMAGE_DETAILS[number];

export interface ImageRecognitionOptions {
  imageUrl?: string;
  base64?: string;
  mimeType?: string;
  prompt?: string;
  detail?: ImageRecognitionDetail;
  maxTokens?: number;
}

export interface ImageRecognitionResult {
  description: string;
  model: string;
  detail: ImageRecognitionDetail;
  usage?: Record<string, unknown>;
}

type ImageRecognitionContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail: ImageRecognitionDetail } };

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  usage?: unknown;
  error?: {
    message?: unknown;
  };
}

export class ImageRecognitionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageRecognitionValidationError';
  }
}

function isImageRecognitionDetail(value: unknown): value is ImageRecognitionDetail {
  return typeof value === 'string' && VALID_IMAGE_DETAILS.includes(value as ImageRecognitionDetail);
}

function normalizeMimeType(mimeType: string | undefined): typeof SUPPORTED_IMAGE_MIME_TYPES[number] {
  const normalized = (mimeType || 'image/png').trim().toLowerCase();
  const candidate = normalized === 'image/jpg' ? 'image/jpeg' : normalized;

  if (!SUPPORTED_IMAGE_MIME_TYPES.includes(candidate as typeof SUPPORTED_IMAGE_MIME_TYPES[number])) {
    throw new ImageRecognitionValidationError(`不支持的图片 MIME 类型: ${mimeType || candidate}`);
  }

  return candidate as typeof SUPPORTED_IMAGE_MIME_TYPES[number];
}

function normalizeBase64Image(base64: string, mimeType: string | undefined): string {
  const trimmed = base64.trim();
  if (!trimmed) {
    throw new ImageRecognitionValidationError('base64 图片内容不能为空');
  }
  if (trimmed.length > MAX_BASE64_LENGTH) {
    throw new ImageRecognitionValidationError('base64 图片内容过大，最大支持 20MB 字符串');
  }
  if (trimmed.startsWith('data:')) {
    if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)) {
      throw new ImageRecognitionValidationError('base64 data URL 仅支持 png、jpeg、webp、gif 图片');
    }
    return trimmed;
  }

  const payload = trimmed.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) {
    throw new ImageRecognitionValidationError('base64 图片内容格式无效');
  }

  return `data:${normalizeMimeType(mimeType)};base64,${payload}`;
}

function normalizeImageUrl(options: Pick<ImageRecognitionOptions, 'imageUrl' | 'base64' | 'mimeType'>): string {
  const imageUrl = options.imageUrl?.trim();
  const base64 = options.base64?.trim();

  if (!imageUrl && !base64) {
    throw new ImageRecognitionValidationError('请提供 imageUrl 或 base64 图片内容');
  }

  if (imageUrl) {
    if (!/^https?:\/\//i.test(imageUrl) && !imageUrl.startsWith('data:')) {
      throw new ImageRecognitionValidationError('imageUrl 仅支持 http(s) URL 或 data URL');
    }
    return imageUrl;
  }

  return normalizeBase64Image(base64 || '', options.mimeType);
}

function normalizePrompt(prompt: string | undefined): string {
  const normalized = prompt?.trim() || DEFAULT_IMAGE_RECOGNITION_PROMPT;
  if (normalized.length > MAX_PROMPT_LENGTH) {
    throw new ImageRecognitionValidationError(`识图提示词不能超过 ${MAX_PROMPT_LENGTH} 字符`);
  }
  return normalized;
}

function normalizeMaxTokens(maxTokens: number | undefined): number {
  if (maxTokens === undefined) {
    return DEFAULT_MAX_TOKENS;
  }
  if (!Number.isFinite(maxTokens) || maxTokens < 1 || maxTokens > 4000) {
    throw new ImageRecognitionValidationError('maxTokens 必须是 1 到 4000 之间的数字');
  }
  return Math.floor(maxTokens);
}

function buildOpenAICompatibleUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');

  if (normalizedBaseUrl.endsWith('/v1')) {
    return `${normalizedBaseUrl}/${normalizedPath}`;
  }

  return `${normalizedBaseUrl}/v1/${normalizedPath}`;
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  return '';
}

function extractUsage(usage: unknown): Record<string, unknown> | undefined {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
    return undefined;
  }
  return usage as Record<string, unknown>;
}

async function readErrorMessage(response: Response): Promise<string> {
  const errorText = await response.text();
  try {
    const parsed = JSON.parse(errorText) as ChatCompletionResponse & { message?: unknown };
    const message = parsed.error?.message || parsed.message;
    if (typeof message === 'string' && message.trim()) {
      return message.slice(0, 1000);
    }
  } catch {
    // Fall through to raw text.
  }
  return errorText.slice(0, 1000);
}

export function validateImageRecognitionOptions(options: ImageRecognitionOptions): void {
  normalizeImageUrl(options);
  normalizePrompt(options.prompt);
  normalizeMaxTokens(options.maxTokens);

  if (options.detail !== undefined && !isImageRecognitionDetail(options.detail)) {
    throw new ImageRecognitionValidationError(`detail 仅支持: ${VALID_IMAGE_DETAILS.join(', ')}`);
  }
}

export async function recognizeImage(options: ImageRecognitionOptions): Promise<ImageRecognitionResult> {
  validateImageRecognitionOptions(options);

  const config = await getAIConfig(IMAGE_RECOGNITION_SCENARIO);
  const imageUrl = normalizeImageUrl(options);
  const prompt = normalizePrompt(options.prompt);
  const detail = options.detail || 'low';
  const maxTokens = normalizeMaxTokens(options.maxTokens ?? config.max_tokens ?? DEFAULT_MAX_TOKENS);
  const endpoint = buildOpenAICompatibleUrl(config.base_url, 'chat/completions');
  const content: ImageRecognitionContentPart[] = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: imageUrl, detail } },
  ];

  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
    max_tokens: maxTokens,
  };

  if (typeof config.temperature === 'number') {
    body.temperature = config.temperature;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detailMessage = await readErrorMessage(response);
    throw new Error(`识图模型调用失败 (${response.status}): ${detailMessage}`);
  }

  const result = await response.json() as ChatCompletionResponse;
  const description = extractTextContent(result.choices?.[0]?.message?.content);
  if (!description) {
    console.error('图片识别模型返回格式异常:', {
      endpoint,
      model: config.model,
      responseKeys: result && typeof result === 'object' ? Object.keys(result) : [],
    });
    throw new Error('图片识别模型返回数据异常，未包含文本描述');
  }

  const usage = extractUsage(result.usage);

  return {
    description,
    model: config.model,
    detail,
    ...(usage ? { usage } : {}),
  };
}
