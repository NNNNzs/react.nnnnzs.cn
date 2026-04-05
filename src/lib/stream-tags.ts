/**
 * 流式标签工具
 * 用于生成和解析流式响应中的 XML 标签格式
 *
 * 协议规范：
 * - <think content="..."/> — 自闭合标签，状态提示（初始化、检索信息等）
 * - <step type="thought|action|observation" index="N">...</step> — ReAct 循环步骤
 * - <content>...</content> — 最终答案
 */

/**
 * 标签类型
 */
export type StreamTagType = 'think' | 'content' | 'step';

/**
 * step 标签的子类型
 */
export type StepType = 'thought' | 'action' | 'observation';

/**
 * 流式标签数据
 */
export interface StreamTag {
  type: StreamTagType;
  content: string;
  /** step 标签的子类型 */
  stepType?: StepType;
  /** step 标签的轮次索引（从 1 开始） */
  stepIndex?: number;
}

/**
 * 标签生成器
 * 用于后端生成符合规范的标签格式
 */
export class StreamTagGenerator {
  private encoder: TextEncoder;

  constructor() {
    this.encoder = new TextEncoder();
  }

  /**
   * 生成 think 自闭合标签（状态提示）
   * 输出格式: <think content="转义后的内容"/>
   * @param content 提示内容
   * @returns 编码后的标签数据
   */
  generateThink(content: string): Uint8Array {
    const escaped = this.escapeXml(content);
    return this.encoder.encode(`<think content="${escaped}"/>`);
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
   * 开始 step 标签（用于流式 thought）
   * @param type step 子类型
   * @param index 轮次索引
   * @returns 编码后的开始标签
   */
  startStep(type: StepType, index: number): Uint8Array {
    return this.encoder.encode(`<step type="${type}" index="${index}">`);
  }

  /**
   * 结束 step 标签
   * @returns 编码后的结束标签
   */
  endStep(): Uint8Array {
    return this.encoder.encode('</step>');
  }

  /**
   * 生成完整的 step 标签（用于 action/observation 等一次性内容）
   * @param type step 子类型
   * @param index 轮次索引
   * @param content 标签内容
   * @returns 编码后的完整标签
   */
  generateStep(type: StepType, index: number, content: string): Uint8Array {
    return this.encoder.encode(
      `<step type="${type}" index="${index}">${this.escapeXml(content)}</step>`
    );
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
 * 用于前端解析流式响应中的 XML 标签
 *
 * 支持三种标签：
 * 1. <think content="..."/> — 自闭合，直接提取 content 属性
 * 2. <step type="..." index="...">...</step> — 支持流式，逐步输出内容
 * 3. <content>...</content> — 支持流式，逐步输出内容
 */
export class StreamTagParser {
  private decoder: TextDecoder;
  private buffer: string = '';
  private inContent: boolean = false;
  private inStep: boolean = false;
  private stepType: StepType | null = null;
  private stepIndex: number = 0;

  constructor() {
    this.decoder = new TextDecoder();
  }

  /**
   * 解析流式数据
   * @param chunk 数据块
   * @param onTag 标签回调
   */
  parseChunk(chunk: Uint8Array, onTag: (tag: StreamTag) => void): void {
    const text = this.decoder.decode(chunk, { stream: true });
    this.buffer += text;
    this.parseBuffer(onTag);
  }

  /**
   * 完成解析（处理剩余缓冲区）
   * @param onTag 标签回调
   */
  finish(onTag: (tag: StreamTag) => void): void {
    if (this.inContent && this.buffer) {
      onTag({ type: 'content', content: this.unescapeXml(this.buffer) });
    } else if (this.inStep && this.buffer) {
      onTag({
        type: 'step',
        content: this.unescapeXml(this.buffer),
        stepType: this.stepType ?? undefined,
        stepIndex: this.stepIndex,
      });
    }
    this.reset();
  }

  /**
   * 解析缓冲区
   */
  private parseBuffer(onTag: (tag: StreamTag) => void): void {
    while (this.buffer.length > 0) {
      // 1. 自由状态下，尝试匹配各种开始标签
      if (!this.inContent && !this.inStep) {
        // 匹配自闭合 <think content="..."/>
        const thinkMatch = this.buffer.match(/^<think\s+content="((?:[^"]|&(?:quot|amp|lt|gt|apos);)*)"\s*\/>/);
        if (thinkMatch) {
          onTag({ type: 'think', content: this.unescapeXml(thinkMatch[1]) });
          this.buffer = this.buffer.substring(thinkMatch[0].length);
          continue;
        }

        // 匹配 <step type="..." index="...">
        const stepStartMatch = this.buffer.match(/^<step\s+type="(\w+)"\s+index="(\d+)">/);
        if (stepStartMatch) {
          this.inStep = true;
          this.stepType = stepStartMatch[1] as StepType;
          this.stepIndex = parseInt(stepStartMatch[2], 10);
          this.buffer = this.buffer.substring(stepStartMatch[0].length);
          continue;
        }

        // 匹配 <content>
        if (this.buffer.startsWith('<content>')) {
          this.inContent = true;
          this.buffer = this.buffer.substring(9);
          continue;
        }

        // 都不匹配，跳过一个字符
        this.buffer = this.buffer.substring(1);
        continue;
      }

      // 2. step 内容解析（流式输出）
      if (this.inStep) {
        const stepEnd = this.buffer.indexOf('</step>');
        if (stepEnd !== -1) {
          const remaining = this.buffer.substring(0, stepEnd);
          if (remaining) {
            onTag({
              type: 'step',
              content: this.unescapeXml(remaining),
              stepType: this.stepType ?? undefined,
              stepIndex: this.stepIndex,
            });
          }
          this.buffer = this.buffer.substring(stepEnd + 7);
          this.inStep = false;
          this.stepType = null;
        } else {
          // 流式输出当前缓冲区
          if (this.buffer.length > 0) {
            const content = this.buffer;
            this.buffer = '';
            onTag({
              type: 'step',
              content: this.unescapeXml(content),
              stepType: this.stepType ?? undefined,
              stepIndex: this.stepIndex,
            });
          }
          break;
        }
        continue;
      }

      // 3. content 内容解析（流式输出）
      if (this.inContent) {
        const contentEnd = this.buffer.indexOf('</content>');
        if (contentEnd !== -1) {
          const remaining = this.buffer.substring(0, contentEnd);
          if (remaining) {
            onTag({ type: 'content', content: this.unescapeXml(remaining) });
          }
          this.buffer = this.buffer.substring(contentEnd + 10);
          this.inContent = false;
        } else {
          if (this.buffer.length > 0) {
            const content = this.buffer;
            this.buffer = '';
            onTag({ type: 'content', content: this.unescapeXml(content) });
          }
          break;
        }
        continue;
      }
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
    this.inContent = false;
    this.inStep = false;
    this.stepType = null;
    this.stepIndex = 0;
  }
}
