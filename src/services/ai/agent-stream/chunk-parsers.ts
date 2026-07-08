/**
 * Agent 流式 chunk 解析 — 共享层
 *
 * 从 LangChain streamEvents 的 chunk 中提取：
 * - reasoning_content（思考 / 推理 token，DeepSeek 等模型在 provider 特定字段里下发）
 * - 文本正文 content
 * - 工具返回 observation（把 JSON 结果解析成人类可读摘要）
 *
 * 所有函数只吃 unknown，不依赖 LangChain 类型，chat-agent 与 create-agent 共用。
 *
 * @module agent-stream/chunk-parsers
 */

/** 值为对象则返回其 Record 视图，否则 undefined */
export function getRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return undefined;
}

/** 从对象取字符串字段，非字符串返回空串 */
export function getStringField(source: unknown, key: string): string {
  const record = getRecord(source);
  const value = record?.[key];
  return typeof value === 'string' ? value : '';
}

/**
 * 从 chunk 中提取文本正文 content。
 * 兼容 string 和 content parts 数组（[{text: ...}, ...]）两种形态。
 */
export function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      const record = getRecord(part);
      if (!record) return '';
      if (typeof record.text === 'string') return record.text;
      return '';
    })
    .join('');
}

/**
 * 从 chunk 提取推理（reasoning）内容。
 *
 * DeepSeek OpenAI-compatible streaming chunks 把 reasoning token 放在
 * provider 特定字段里，LangChain 在不同 adapter/version 下保留位置不同，
 * 因此依次检查所有常见位置。
 */
export function extractReasoningContent(chunk: unknown): string {
  const record = getRecord(chunk);
  if (!record) return '';

  const direct = getStringField(record, 'reasoning_content')
    || getStringField(record, 'reasoning');
  if (direct) return direct;

  const additionalKwargs = getRecord(record.additional_kwargs);
  const fromAdditional = getStringField(additionalKwargs, 'reasoning_content')
    || getStringField(additionalKwargs, 'reasoning');
  if (fromAdditional) return fromAdditional;

  const responseMetadata = getRecord(record.response_metadata);
  const fromMetadata = getStringField(responseMetadata, 'reasoning_content')
    || getStringField(responseMetadata, 'reasoning');
  if (fromMetadata) return fromMetadata;

  const kwargs = getRecord(record.lc_kwargs);
  const kwargsAdditional = getRecord(kwargs?.additional_kwargs);
  return getStringField(kwargsAdditional, 'reasoning_content')
    || getStringField(kwargsAdditional, 'reasoning');
}

/**
 * 把工具返回内容解析成人类可读的 observation 文本。
 *
 * 尝试 JSON.parse：若是带 results 数组的检索结果，取标题摘要；
 * 否则返回原文（截断）。
 */
export function extractObservationText(data: unknown): string {
  const event = getRecord(data);
  if (!event) return '';

  const output = getRecord(event.output);
  if (!output) return '';

  const kw = getRecord(output.lc_kwargs) || output;
  const content = getStringField(kw, 'content');
  if (!content) return '';

  try {
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed.results) && parsed.results.length > 0) {
      const total = parsed.totalResults || parsed.total || parsed.results.length;
      const resultLabel = parsed.type === 'repositories' || parsed.type === 'user_repositories'
        ? '个仓库'
        : parsed.type === 'issues'
          ? '个 Issue/PR'
          : parsed.type === 'users'
            ? '个用户'
            : parsed.type === 'user_starred'
              ? '个 Star 仓库'
              : '篇相关文章';
      const titles = parsed.results
        .slice(0, 5)
        .map((r: {
          title?: string;
          fullName?: string;
          repository?: string;
          login?: string;
          name?: string;
        }, i: number) => {
          const label = r.title || r.fullName || r.repository || r.login || r.name || '未知结果';
          return `${i + 1}. ${label}`;
        })
        .join('\n');
      return `找到 ${total} ${resultLabel}：\n${titles}`;
    }

    if (parsed.results && typeof parsed.total === 'number') {
      return `${parsed.message || `找到 ${parsed.total} 篇文章`}`;
    }

    if (parsed.message) return parsed.message;
    return content.slice(0, 200);
  } catch {
    return content.slice(0, 200);
  }
}
