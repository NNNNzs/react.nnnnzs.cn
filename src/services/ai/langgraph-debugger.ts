/**
 * LangGraph 本地调试日志。
 *
 * 仅在开发环境且 LANGGRAPH_DEBUG=true 时启用，将每次 Agent 运行写入
 * logs/langgraph/YYYY-MM-DD.ndjson。通过包装 streamEvents 保持原始事件流
 * 不变，调用方仍可直接传给现有的 SSE 事件泵。
 */

import { randomUUID } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const DEBUG_FLAG_VALUES = new Set(['1', 'true']);
const DEFAULT_LOG_DIRECTORY = 'logs/langgraph';
const MAX_LOG_STRING_LENGTH = 32_000;
const MAX_LOG_ARRAY_LENGTH = 100;
const MAX_LOG_OBJECT_KEYS = 100;
const MAX_LOG_DEPTH = 12;

type DebugValue =
  | null
  | boolean
  | number
  | string
  | DebugValue[]
  | { [key: string]: DebugValue };

/** LangGraph streamEvents 事件所需的最小字段。 */
export interface LangGraphStreamEvent {
  event: string;
  data?: unknown;
  name?: string;
  run_id?: string;
}

/** 创建本地调试器时使用的运行信息，不应放入用户输入或草稿正文。 */
export interface LangGraphDebuggerOptions {
  agentName: string;
  metadata?: Record<string, unknown>;
}

/** 可复用的 LangGraph 本地调试器。 */
export interface LangGraphDebugger {
  /** 当前本地运行 ID，可用于在 NDJSON 文件中关联同一次 Agent 调用。 */
  readonly localRunId: string;
  /** 包装 LangGraph streamEvents，并把原始事件写入本地日志。 */
  streamEvents: <T extends LangGraphStreamEvent>(
    eventStream: AsyncIterable<T>,
  ) => AsyncIterable<T>;
  /** 记录 Agent 的业务侧事件，例如草稿或选题 patch。 */
  log: (event: string, data?: unknown) => Promise<void>;
}

/** 判断当前进程是否允许写入本地调试日志。 */
function isLangGraphDebugEnabled(): boolean {
  return process.env.NODE_ENV === 'development'
    && DEBUG_FLAG_VALUES.has(process.env.LANGGRAPH_DEBUG?.trim().toLowerCase() ?? '');
}

/** 获取日志目录；相对路径相对于项目根目录解析。 */
function getLogDirectory(): string {
  const configuredDirectory = process.env.LANGGRAPH_DEBUG_DIR?.trim();
  return configuredDirectory
    ? resolve(process.cwd(), configuredDirectory)
    : join(process.cwd(), DEFAULT_LOG_DIRECTORY);
}

/** 使用中国时区生成当天的日志文件名，方便本地排查。 */
function getLogFileName(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${date.year}-${date.month}-${date.day}.ndjson`;
}

/** 将长文本限制在单行日志可接受的大小。 */
function truncateString(value: string): string {
  if (value.length <= MAX_LOG_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_LOG_STRING_LENGTH)}…（已截断，原长度 ${value.length}）`;
}

/** 将任意运行时值转为可 JSON 序列化、可脱敏的日志值。 */
function toDebugValue(
  value: unknown,
  includeContent: boolean,
  visited: WeakSet<object>,
  depth = 0,
): DebugValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    if (includeContent) return truncateString(value);
    return { redacted: true, length: value.length };
  }

  if (typeof value === 'undefined') return '[undefined]';
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') return `[function ${value.name || 'anonymous'}]`;
  if (depth >= MAX_LOG_DEPTH) return '[最大嵌套深度已截断]';

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: toDebugValue(value.message, includeContent, visited, depth + 1),
      stack: includeContent && value.stack ? truncateString(value.stack) : '[已脱敏]',
    };
  }

  if (typeof value !== 'object') return String(value);
  if (visited.has(value)) return '[循环引用]';
  visited.add(value);

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_LOG_ARRAY_LENGTH).map((item) => (
      toDebugValue(item, includeContent, visited, depth + 1)
    ));
    if (value.length > MAX_LOG_ARRAY_LENGTH) {
      items.push(`[数组已截断，原长度 ${value.length}]`);
    }
    return items;
  }

  const record: { [key: string]: DebugValue } = {};
  const entries = Object.entries(value).slice(0, MAX_LOG_OBJECT_KEYS);
  for (const [key, item] of entries) {
    record[key] = toDebugValue(item, includeContent, visited, depth + 1);
  }
  if (Object.keys(value).length > MAX_LOG_OBJECT_KEYS) {
    record.__truncated__ = `[对象字段已截断，原字段数 ${Object.keys(value).length}]`;
  }
  return record;
}

/** 顺序写入单个 NDJSON 文件，避免同一请求的事件顺序错乱。 */
class LocalDebugWriter {
  private writeQueue: Promise<void> = Promise.resolve();
  private hasWriteError = false;

  constructor(
    private readonly logPath: string,
    private readonly agentName: string,
    private readonly localRunId: string,
    private readonly includeContent: boolean,
  ) {}

  /** 写入一条结构化调试记录；日志异常不会影响 Agent 执行。 */
  write(kind: string, data?: unknown): Promise<void> {
    const record = {
      timestamp: new Date().toISOString(),
      kind,
      agent: this.agentName,
      localRunId: this.localRunId,
      data: data === undefined
        ? undefined
        : toDebugValue(data, this.includeContent, new WeakSet<object>()),
    };
    const line = `${JSON.stringify(record)}\n`;

    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await mkdir(dirname(this.logPath), { recursive: true });
        await appendFile(this.logPath, line, 'utf8');
      } catch (error) {
        if (!this.hasWriteError) {
          this.hasWriteError = true;
          console.warn('[langgraph-debug] 写入本地日志失败，已跳过后续日志：', error);
        }
      }
    });
    return this.writeQueue;
  }
}

/**
 * 创建 LangGraph 本地调试器。
 *
 * 生产环境始终禁用；开发环境设置 LANGGRAPH_DEBUG=true 后生效。
 */
export function createLangGraphDebugger(
  options: LangGraphDebuggerOptions,
): LangGraphDebugger {
  const isEnabled = isLangGraphDebugEnabled();
  const localRunId = randomUUID();
  const includeContent = DEBUG_FLAG_VALUES.has(
    process.env.LANGGRAPH_DEBUG_CONTENT?.trim().toLowerCase() ?? '',
  );
  const logPath = join(getLogDirectory(), getLogFileName());
  const writer = isEnabled
    ? new LocalDebugWriter(logPath, options.agentName, localRunId, includeContent)
    : null;
  let hasStarted = false;

  const log = async (event: string, data?: unknown): Promise<void> => {
    await ensureStarted();
    if (!writer) return;
    await writer.write(event, data);
  };

  const ensureStarted = async (): Promise<void> => {
    if (!writer || hasStarted) return;
    hasStarted = true;
    await writer.write('run_start', { metadata: options.metadata ?? {} });
    console.info(`[langgraph-debug] ${options.agentName} ${localRunId} -> ${logPath}`);
  };

  return {
    localRunId,
    log,
    async *streamEvents<T extends LangGraphStreamEvent>(
      eventStream: AsyncIterable<T>,
    ): AsyncIterable<T> {
      if (!writer) {
        for await (const event of eventStream) {
          yield event;
        }
        return;
      }

      await ensureStarted();
      try {
        for await (const event of eventStream) {
          await writer.write('langgraph_event', {
            event: event.event,
            name: event.name ?? null,
            langGraphRunId: event.run_id ?? null,
            data: event.data,
          });
          yield event;
        }
        await writer.write('run_end', { status: 'completed' });
      } catch (error) {
        await writer.write('run_end', { status: 'failed', error });
        throw error;
      }
    },
  };
}
