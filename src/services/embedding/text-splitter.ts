/**
 * 文本语义切片服务
 * 将文章内容按照语义进行切分，生成适合向量化的文本片段
 */

/**
 * 文本切片配置
 */
interface TextSplitterConfig {
  /** 每个片段的最大字符数 */
  chunkSize?: number;
  /** 片段之间的重叠字符数 */
  chunkOverlap?: number;
  /** 最小片段字符数 */
  minChunkSize?: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<TextSplitterConfig> = {
  chunkSize: 500, // 每个片段约500字符
  chunkOverlap: 100, // 重叠100字符
  minChunkSize: 100, // 最小片段100字符
};

/**
 * 文本切片结果
 */
export interface TextChunk {
  /** 片段文本 */
  text: string;
  /** 片段索引 */
  index: number;
  /** 片段在原文本中的起始位置 */
  startIndex: number;
  /** 片段在原文本中的结束位置 */
  endIndex: number;
}

/**
 * 智能文本切片
 * 按照段落、句子和字符数进行切分
 * 
 * @param text 要切分的文本
 * @param config 切片配置
 * @returns 文本片段数组
 */
export function splitTextIntoChunks(
  text: string,
  config: TextSplitterConfig = {}
): TextChunk[] {
  const { chunkSize, chunkOverlap, minChunkSize } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  if (!text || text.trim().length === 0) {
    return [];
  }

  // 清理文本：移除多余的空白字符
  const cleanedText = text.replace(/\s+/g, ' ').trim();

  // 如果文本长度小于等于 chunkSize，直接返回
  if (cleanedText.length <= chunkSize) {
    return [
      {
        text: cleanedText,
        index: 0,
        startIndex: 0,
        endIndex: cleanedText.length,
      },
    ];
  }

  const chunks: TextChunk[] = [];
  let currentIndex = 0;
  let chunkIndex = 0;

  // 按照段落分割（双换行符）
  const paragraphs = cleanedText.split(/\n\n+/);

  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) {
      continue;
    }

    // 如果段落本身就很长，需要进一步切分
    if (paragraph.length > chunkSize) {
      // 按照句子分割
      const sentences = paragraph.split(/([。！？\n])/);
      let currentChunk = '';
      let sentenceStartIndex = currentIndex;

      for (let i = 0; i < sentences.length; i += 2) {
        const sentence = sentences[i] + (sentences[i + 1] || '');
        
        // 如果当前句子加上已有内容超过 chunkSize，保存当前片段
        if (currentChunk.length + sentence.length > chunkSize && currentChunk.length >= minChunkSize) {
          chunks.push({
            text: currentChunk.trim(),
            index: chunkIndex++,
            startIndex: sentenceStartIndex,
            endIndex: currentIndex + currentChunk.length,
          });

          // 设置重叠：从当前片段末尾往前取 chunkOverlap 字符
          const overlapStart = Math.max(
            sentenceStartIndex,
            currentIndex + currentChunk.length - chunkOverlap
          );
          currentChunk = cleanedText.substring(overlapStart, currentIndex + currentChunk.length);
          sentenceStartIndex = overlapStart;
        }

        currentChunk += sentence;
        currentIndex += sentence.length;
      }

      // 处理最后一个片段
      if (currentChunk.trim().length >= minChunkSize) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex++,
          startIndex: sentenceStartIndex,
          endIndex: currentIndex,
        });
      }
    } else {
      // 段落长度合适，直接作为一个片段
      // 检查是否需要与上一个片段合并
      const lastChunk = chunks[chunks.length - 1];
      if (
        lastChunk &&
        lastChunk.text.length + paragraph.length <= chunkSize
      ) {
        // 合并到上一个片段
        lastChunk.text += '\n\n' + paragraph.trim();
        lastChunk.endIndex = currentIndex + paragraph.length;
      } else {
        // 创建新片段
        chunks.push({
          text: paragraph.trim(),
          index: chunkIndex++,
          startIndex: currentIndex,
          endIndex: currentIndex + paragraph.length,
        });
      }
      currentIndex += paragraph.length;
    }
  }

  // 过滤掉太小的片段
  return chunks.filter((chunk) => chunk.text.length >= minChunkSize);
}

/**
 * 从 Markdown 文本中提取纯文本并切片
 * 移除 Markdown 语法，保留文本内容
 * 
 * @param markdown Markdown 格式的文本
 * @param config 切片配置
 * @returns 文本片段数组
 */
export function splitMarkdownIntoChunks(
  markdown: string,
  config: TextSplitterConfig = {}
): TextChunk[] {
  if (!markdown || markdown.trim().length === 0) {
    return [];
  }

  // 移除 Markdown 语法，保留文本内容
  const plainText = markdown
    // 移除代码块
    .replace(/```[\s\S]*?```/g, '')
    // 移除行内代码
    .replace(/`[^`]+`/g, '')
    // 移除链接，保留链接文本
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // 移除图片
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
    // 移除标题标记
    .replace(/^#{1,6}\s+/gm, '')
    // 移除粗体和斜体标记
    .replace(/\*\*([^\*]+)\*\*/g, '$1')
    .replace(/\*([^\*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // 移除删除线
    .replace(/~~([^~]+)~~/g, '$1')
    // 移除引用标记
    .replace(/^>\s+/gm, '')
    // 移除列表标记
    .replace(/^[\*\-\+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // 清理多余空白
    .replace(/\s+/g, ' ')
    .trim();

  // 使用普通文本切片
  return splitTextIntoChunks(plainText, config);
}
