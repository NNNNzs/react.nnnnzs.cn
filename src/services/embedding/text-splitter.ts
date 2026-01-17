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
 * 基于标题（##）的语义分块（MVP 方案）
 * 兼容处理无标题的大段文字
 * 
 * @param markdown Markdown 格式的文本
 * @param config 切片配置
 * @returns 文本片段数组
 */
export function splitMarkdownByHeadings(
  markdown: string,
  config: TextSplitterConfig = {}
): TextChunk[] {
  if (!markdown || markdown.trim().length === 0) {
    return [];
  }

  // 查找所有二级标题的位置
  const headingPattern = /^##\s+(.+)$/gm;
  const headingMatches: Array<{ index: number; title: string }> = [];
  let match;

  // 重置 lastIndex 以确保从开头搜索
  headingPattern.lastIndex = 0;
  while ((match = headingPattern.exec(markdown)) !== null) {
    headingMatches.push({
      index: match.index,
      title: match[1].trim(),
    });
  }

  // 如果没有找到标题，返回空数组（让调用者使用其他方法）
  if (headingMatches.length === 0) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let chunkIndex = 0;

  // 处理每个标题区块
  for (let i = 0; i < headingMatches.length; i++) {
    const currentHeading = headingMatches[i];
    const nextHeadingIndex = i < headingMatches.length - 1 
      ? headingMatches[i + 1].index 
      : markdown.length;

    // 提取标题后的内容（从标题行结束到下一个标题开始）
    const headingLineEnd = markdown.indexOf('\n', currentHeading.index);
    const contentStart = headingLineEnd >= 0 ? headingLineEnd + 1 : currentHeading.index + currentHeading.title.length + 3;
    const content = markdown.substring(contentStart, nextHeadingIndex).trim();

    if (!content) {
      continue;
    }

    // 优化 Markdown 语法处理，保留关键内容
    const plainText = content
      // 代码块：提取语言标记和第一行注释
      .replace(/```[\s\S]*?```/g, (match) => {
        const lines = match.split('\n');
        if (lines.length >= 2) {
          const lang = lines[0].replace(/```\w*/, '').trim() || '代码';
          return `[${lang}块] `;
        }
        return '';
      })
      // 行内代码：保留代码内容（移除反引号）
      .replace(/`([^`]+)`/g, '$1')
      // 移除链接，保留链接文本
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // 移除图片
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
      // 移除标题标记（处理三级及以下标题）
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
      // 清理多余空白（保留换行）
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!plainText) {
      continue;
    }

    // 如果区块内容太长，使用普通文本切片进一步分割
    const { chunkSize = 500 } = config;
    
    if (plainText.length > chunkSize) {
      // 使用普通文本切片进一步分割大块内容
      const subChunks = splitTextIntoChunks(plainText, config);
      for (const subChunk of subChunks) {
        chunks.push({
          text: subChunk.text,
          index: chunkIndex++,
          startIndex: contentStart + subChunk.startIndex,
          endIndex: contentStart + subChunk.endIndex,
        });
      }
    } else {
      // 区块大小合适，直接作为一个 chunk
      chunks.push({
        text: plainText,
        index: chunkIndex++,
        startIndex: contentStart,
        endIndex: contentStart + content.length,
      });
    }
  }

  return chunks;
}

/**
 * 从 Markdown 文本中提取纯文本并切片
 * 移除 Markdown 语法，保留文本内容
 * 兼容处理非标准 Markdown 格式和老文章
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

  // 尝试使用基于标题的分块（如果文章有标题结构）
  const headingChunks = splitMarkdownByHeadings(markdown, config);

  // 如果基于标题的分块成功产生了多个区块，使用它
  // 否则使用原来的纯文本分块方法（兼容无标题的大段文字）
  // 修改：只要 headingChunks 有内容就使用，即使只有1个chunk
  if (headingChunks.length > 0) {
    return headingChunks;
  }

  // 回退到原来的方法：优化 Markdown 语法处理，保留关键内容
  const plainText = markdown
    // 代码块：提取语言标记和第一行注释
    .replace(/```[\s\S]*?```/g, (match) => {
      const lines = match.split('\n');
      if (lines.length >= 2) {
        const lang = lines[0].replace(/```\w*/, '').trim() || '代码';
        return `[${lang}块] `;
      }
      return '';
    })
    // 行内代码：保留代码内容（移除反引号）
    .replace(/`([^`]+)`/g, '$1')
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
    // 清理多余空白（保留换行，兼容大段文字）
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 使用普通文本切片
  return splitTextIntoChunks(plainText, config);
}
