export const SEO_DESCRIPTION_MAX_LENGTH = 160;
export const SEO_AGGREGATE_MIN_POSTS = 3;

export type SeoQualityRiskCode =
  | 'short-content'
  | 'short-description'
  | 'placeholder-title'
  | 'missing-taxonomy';

export interface SeoQualityRisk {
  code: SeoQualityRiskCode;
  message: string;
}

const PLACEHOLDER_TITLE_PATTERN = /^(?:(?:无标题(?:文章)?|未命名(?:文章)?|untitled|test|测试(?:文章)?|todo|临时(?:文章)?)\s*\d*|\d+)$/i;

function decodeBasicHtmlEntities(value: string): string {
  const entities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };
  const decodeCodePoint = (entity: string, codePoint: number) => {
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return entity;
    }
  };
  return value
    .replace(/&#(\d+);/g, (entity, code: string) => decodeCodePoint(entity, Number(code)))
    .replace(/&#x([\da-f]+);/gi, (entity, code: string) => decodeCodePoint(entity, Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => entities[name.toLowerCase()] ?? entity);
}

/** 将 Markdown/HTML 清洗成适合 metadata 与质量判断的纯文本。 */
export function markdownToPlainText(markdown: string | null | undefined): string {
  if (!markdown) return '';

  return decodeBasicHtmlEntities(markdown)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(```|~~~)[^\n]*$/gm, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createSeoDescription(
  preferred: string | null | undefined,
  content: string | null | undefined,
  fallback: string,
): string {
  const plainText = markdownToPlainText(preferred) || markdownToPlainText(content) || fallback.trim();
  return Array.from(plainText).slice(0, SEO_DESCRIPTION_MAX_LENGTH).join('');
}

export function getSeoQualityRisks(input: {
  title?: string | null;
  content?: string | null;
  description?: string | null;
  category?: string | null;
  tags?: string[] | string | null;
}): SeoQualityRisk[] {
  const risks: SeoQualityRisk[] = [];
  const contentLength = Array.from(markdownToPlainText(input.content).replace(/\s/g, '')).length;
  const descriptionLength = Array.from(markdownToPlainText(input.description)).length;
  const title = input.title?.trim() || '';
  const tags = Array.isArray(input.tags)
    ? input.tags.filter((tag) => tag.trim())
    : String(input.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);

  if (contentLength < 800) {
    risks.push({ code: 'short-content', message: `正文清洗后约 ${contentLength} 字，少于建议的 800 字` });
  }
  if (descriptionLength < 50) {
    risks.push({ code: 'short-description', message: '文章描述缺失或少于 50 字' });
  }
  if (!title || PLACEHOLDER_TITLE_PATTERN.test(title)) {
    risks.push({ code: 'placeholder-title', message: '标题为空或疑似占位标题' });
  }
  if (!input.category?.trim() && tags.length === 0) {
    risks.push({ code: 'missing-taxonomy', message: '文章没有分类与标签' });
  }

  return risks;
}

export function meetsSeoAggregateThreshold(indexablePostCount: number): boolean {
  return indexablePostCount >= SEO_AGGREGATE_MIN_POSTS;
}
