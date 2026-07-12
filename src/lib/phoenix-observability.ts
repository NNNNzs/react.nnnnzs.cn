/**
 * Phoenix 可观测性运行时。
 *
 * 配置由 /c/config 管理：
 * - phoenix.enabled: true / false
 * - phoenix.settings: JSON（projectName、collectorEndpoint、apiKey、脱敏开关）
 *
 * OTel Provider 在一个 Node.js 进程中只能注册一次。因此修改 Phoenix
 * 配置后需要重启应用进程，随后第一条 Agent 请求会按新配置初始化。
 */

import { configByKeys } from '@/services/config';

const PHOENIX_ENABLED_KEY = 'phoenix.enabled';
const PHOENIX_SETTINGS_KEY = 'phoenix.settings';

interface PhoenixSettings {
  projectName?: unknown;
  project_name?: unknown;
  collectorEndpoint?: unknown;
  collector_endpoint?: unknown;
  url?: unknown;
  apiKey?: unknown;
  api_key?: unknown;
  hideInputText?: unknown;
  hide_input_text?: unknown;
  hideOutputText?: unknown;
  hide_output_text?: unknown;
}

interface PhoenixConfig {
  enabled: boolean;
  projectName: string;
  collectorEndpoint: string;
  apiKey?: string;
  hideInputText: boolean;
  hideOutputText: boolean;
}

export interface PhoenixAgentTraceOptions {
  name: string;
  userId?: number;
  metadata: Record<string, unknown>;
}

type PhoenixRuntime = typeof import('@arizeai/phoenix-otel');

interface PhoenixGlobalState {
  runtime?: PhoenixRuntime;
  initializing?: Promise<PhoenixRuntime | null>;
}

const globalPhoenix = globalThis as typeof globalThis & {
  __phoenixObservability?: PhoenixGlobalState;
};

function getGlobalState(): PhoenixGlobalState {
  if (!globalPhoenix.__phoenixObservability) {
    globalPhoenix.__phoenixObservability = {};
  }
  return globalPhoenix.__phoenixObservability;
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return defaultValue;
}

async function getPhoenixConfig(): Promise<PhoenixConfig> {
  const configs = await configByKeys([PHOENIX_ENABLED_KEY, PHOENIX_SETTINGS_KEY]);
  const enabled = toBoolean(configs[PHOENIX_ENABLED_KEY]?.value, false);
  const rawSettings = configs[PHOENIX_SETTINGS_KEY]?.value;

  let settings: PhoenixSettings = {};
  if (rawSettings?.trim()) {
    try {
      const parsed: unknown = JSON.parse(rawSettings);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        settings = parsed as PhoenixSettings;
      }
    } catch (error) {
      console.warn('[phoenix] phoenix.settings 不是有效 JSON，已跳过追踪初始化：', error);
    }
  }

  return {
    enabled,
    projectName: toStringValue(settings.projectName ?? settings.project_name) || 'react-nnnnzs-cn',
    collectorEndpoint: toStringValue(
      settings.collectorEndpoint ?? settings.collector_endpoint ?? settings.url,
    ),
    apiKey: toStringValue(settings.apiKey ?? settings.api_key) || undefined,
    // 创作内容可能含私有草稿，默认仅采集结构、耗时和元数据。
    hideInputText: toBoolean(settings.hideInputText ?? settings.hide_input_text, true),
    hideOutputText: toBoolean(settings.hideOutputText ?? settings.hide_output_text, true),
  };
}

async function initializePhoenix(config: PhoenixConfig): Promise<PhoenixRuntime | null> {
  const state = getGlobalState();
  if (state.runtime) return state.runtime;
  if (state.initializing) return state.initializing;

  if (!config.collectorEndpoint) {
    console.warn('[phoenix] 未配置 collectorEndpoint，已跳过追踪初始化');
    return null;
  }

  state.initializing = (async () => {
    try {
      const phoenix = await import('@arizeai/phoenix-otel');
      const { LangChainInstrumentation } = await import('@arizeai/openinference-instrumentation-langchain');
      const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-proto');
      const {
        OpenInferenceBatchSpanProcessor,
        isOpenInferenceSpan,
      } = await import('@arizeai/openinference-vercel');
      const callbackManagerModule = await import('@langchain/core/callbacks/manager');

      const headers: Record<string, string> = {};
      if (config.apiKey) {
        headers.authorization = `Bearer ${config.apiKey}`;
      }
      const exporter = new OTLPTraceExporter({
        url: phoenix.ensureCollectorEndpoint(config.collectorEndpoint),
        headers,
      });
      // Phoenix 默认 Processor 会导出全局 Provider 看到的所有 Next.js span。
      // 只导出带 OpenInference kind 的 Agent / LLM / Tool 调用，过滤普通 HTTP 路由。
      const spanProcessor = new OpenInferenceBatchSpanProcessor({
        exporter,
        spanFilter: isOpenInferenceSpan,
        reparentOrphanedSpans: true,
      });

      phoenix.register({
        projectName: config.projectName,
        spanProcessors: [spanProcessor],
      });

      const instrumentation = new LangChainInstrumentation({
        traceConfig: {
          hideInputText: config.hideInputText,
          hideOutputText: config.hideOutputText,
        },
      });
      instrumentation.manuallyInstrument(callbackManagerModule);

      state.runtime = phoenix;
      console.info(`[phoenix] 已连接项目 ${config.projectName}`);
      return phoenix;
    } catch (error) {
      console.warn('[phoenix] 初始化失败，当前 Agent 将继续正常运行：', error);
      return null;
    } finally {
      state.initializing = undefined;
    }
  })();

  return state.initializing;
}

/**
 * 将一次 Agent 执行作为 Phoenix 的根 Agent Span，并让 LangChain 子调用继承上下文。
 */
export async function withPhoenixAgentTrace<T>(
  options: PhoenixAgentTraceOptions,
  operation: () => Promise<T>,
): Promise<T> {
  let config: PhoenixConfig;
  try {
    config = await getPhoenixConfig();
  } catch (error) {
    console.warn('[phoenix] 读取配置失败，已跳过追踪：', error);
    return operation();
  }

  if (!config.enabled) return operation();

  const phoenix = await initializePhoenix(config);
  if (!phoenix) return operation();

  let traceContext = phoenix.setMetadata(phoenix.context.active(), options.metadata);
  if (options.userId !== undefined) {
    traceContext = phoenix.setUser(traceContext, { userId: String(options.userId) });
  }

  const tracedOperation = phoenix.traceAgent(operation, { name: options.name });
  return phoenix.context.with(traceContext, tracedOperation);
}
