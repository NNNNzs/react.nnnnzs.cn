/**
 * 流式标签工具
 * 用于生成和解析流式响应中的标签格式
 */

/**
 * 标签类型
 */
export type StreamTagType = 'think' | 'content';

/**
 * 流式标签数据
 */
export interface StreamTag {
  type: StreamTagType;
  content: string;
}

/**
 * 标签生成器
 * 用于后端生成符合规范的标签格式
 */
export class StreamTagGenerator {
  private encoder: TextEncoder;
  private buffer: string = '';

  constructor() {
    this.encoder = new TextEncoder();
  }

  /**
   * 生成 think 标签
   * @param content 思考内容
   * @returns 编码后的标签数据
   */
  generateThink(content: string): Uint8Array {
    const tag = `<think>${this.escapeXml(content)}</think>`;
    return this.encoder.encode(tag);
  }

  /**
   * 生成 content 标签（流式）
   * @param content 内容（可以是部分内容）
   * @returns 编码后的标签数据
   */
  generateContent(content: string): Uint8Array {
    // 对于流式内容，我们只发送内容部分，标签在开始和结束时添加
    return this.encoder.encode(this.escapeXml(content));
  }

  /**
   * 开始 content 标签
   * @returns 编码后的开始标签
   */
  startContent(): Uint8Array {
    return this.encoder.encode('<content>');
  }

  /**
   * 结束 content 标签
   * @returns 编码后的结束标签
   */
  endContent(): Uint8Array {
    return this.encoder.encode('</content>');
  }

  /**
   * 转义 XML 特殊字符
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

/**
 * 标签解析器
 * 用于前端解析流式响应中的标签
 */
export class StreamTagParser {
  private decoder: TextDecoder;
  private buffer: string = '';
  private inThink: boolean = false;
  private inContent: boolean = false;
  private thinkContent: string = '';
  private contentBuffer: string = '';

  constructor() {
    this.decoder = new TextDecoder();
  }

  /**
   * 解析流式数据
   * @param chunk 数据块
   * @param onTag 标签回调
   * @returns 是否成功解析
   */
  parseChunk(chunk: Uint8Array, onTag: (tag: StreamTag) => void): void {
    const text = this.decoder.decode(chunk, { stream: true });
    this.buffer += text;

    // 解析标签
    this.parseBuffer(onTag);
  }

  /**
   * 完成解析（处理剩余缓冲区）
   * @param onTag 标签回调
   */
  finish(onTag: (tag: StreamTag) => void): void {
    // 处理剩余内容
    if (this.inContent && this.buffer) {
      // 如果还在 content 标签内，输出剩余内容
      onTag({ type: 'content', content: this.unescapeXml(this.buffer) });
    }
    this.buffer = '';
    this.inThink = false;
    this.inContent = false;
    this.thinkContent = '';
    this.contentBuffer = '';
  }

  /**
   * 解析缓冲区
   */
  private parseBuffer(onTag: (tag: StreamTag) => void): void {
    while (this.buffer.length > 0) {
      // 查找 think 标签
      if (!this.inThink && !this.inContent) {
        const thinkStart = this.buffer.indexOf('<think>');
        if (thinkStart !== -1) {
          const thinkEnd = this.buffer.indexOf('</think>', thinkStart);
          if (thinkEnd !== -1) {
            // 找到完整的 think 标签
            const thinkContent = this.buffer.substring(
              thinkStart + 7, // '<think>'.length
              thinkEnd
            );
            onTag({ type: 'think', content: this.unescapeXml(thinkContent) });
            this.buffer = this.buffer.substring(thinkEnd + 8); // '</think>'.length
            continue;
          } else {
            // think 标签未完整，等待更多数据
            this.inThink = true;
            this.thinkContent = this.buffer.substring(thinkStart + 7);
            this.buffer = this.buffer.substring(0, thinkStart);
            break;
          }
        }
      }

      // 处理 think 标签内容
      if (this.inThink) {
        const thinkEnd = this.buffer.indexOf('</think>');
        if (thinkEnd !== -1) {
          // think 标签结束
          this.thinkContent += this.buffer.substring(0, thinkEnd);
          onTag({ type: 'think', content: this.unescapeXml(this.thinkContent) });
          this.buffer = this.buffer.substring(thinkEnd + 8);
          this.inThink = false;
          this.thinkContent = '';
          continue;
        } else {
          // think 标签继续
          this.thinkContent += this.buffer;
          this.buffer = '';
          break;
        }
      }

      // 查找 content 标签
      if (!this.inContent) {
        const contentStart = this.buffer.indexOf('<content>');
        if (contentStart !== -1) {
          this.inContent = true;
          this.buffer = this.buffer.substring(contentStart + 9); // '<content>'.length
          continue;
        }
      }

      // 处理 content 内容
      if (this.inContent) {
        const contentEnd = this.buffer.indexOf('</content>');
        if (contentEnd !== -1) {
          // content 标签结束
          const remainingContent = this.buffer.substring(0, contentEnd);
          if (remainingContent) {
            // 输出剩余内容
            onTag({ type: 'content', content: this.unescapeXml(remainingContent) });
          }
          this.buffer = this.buffer.substring(contentEnd + 10); // '</content>'.length
          this.inContent = false;
          this.contentBuffer = '';
          continue;
        } else {
          // content 内容继续，流式输出当前缓冲区内容
          // 重要：立即输出缓冲区内容，不等待累积
          if (this.buffer.length > 0) {
            const contentToOutput = this.buffer;
            this.buffer = ''; // 先清空缓冲区
            // console.log('📤 StreamTagParser: 输出 content 块，长度:', contentToOutput.length, '预览:', contentToOutput.substring(0, 50));
            onTag({ type: 'content', content: this.unescapeXml(contentToOutput) });
          }
          break;
        }
      }

      // 如果都不匹配，可能是无效数据或等待更多数据
      break;
    }
  }

  /**
   * 反转义 XML 特殊字符
   */
  private unescapeXml(text: string): string {
    return text
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
  }

  /**
   * 重置解析器状态
   */
  reset(): void {
    this.buffer = '';
    this.inThink = false;
    this.inContent = false;
    this.thinkContent = '';
    this.contentBuffer = '';
  }
}
