/**
 * Chat 页面昼夜风格文案配置
 *
 * 采用 key-first 结构：每个文案 key 下包含 day/night 两个变体。
 * 这不是传统 i18n（多语言），而是同一语言下的风格变体：
 *   - day：温和、文艺、适合阅读
 *   - night：赛博朋克、终端、记忆芯片
 *
 * 使用方式：
 *   selectStyleText(chatStyleCopy.pageTitle, variant)
 *
 * 添加新文案时，在此对象中增加一个 key，同时提供 day/night 两个值即可。
 */
import { defineStyleCopy } from '@/lib/site-style/copy';

/** 页面级文案：标题、描述、操作按钮等 */
export const chatStyleCopy = defineStyleCopy({
  // ── 页面头部 ──
  /** 顶部小字 kicker */
  pageKicker: {
    day: '纸上余温',
    night: 'Relic 回响',
  },
  /** 页面标题 */
  pageTitle: {
    day: '纸上余温',
    night: '夜间终端',
  },
  /** 页面描述 */
  pageDescription: {
    day: '如果死后会幻化为书，这便是我提前整理出的草稿。它记录了代码的逻辑，也收纳了旅途的风尘。不必急于定义它是一本菜谱还是登记簿，只需开始对话，让故事发生。',
    night: '这是一枚接入人生之书的记忆芯片。终端会扫描旧文章、旧项目和旧回声，把散落在夜色里的线索重新接回当前会话。',
  },

  // ── 历史会话面板 ──
  /** 回想面板标题 */
  recallPanelTitle: {
    day: '回想',
    night: 'Relic 回响',
  },
  /** 回想面板描述 */
  recallPanelDescription: {
    day: '在旧问题和旧答案之间，翻回那些曾经写下的页边注。',
    night: '从记忆芯片里调取旧回声，把曾经的对话重新接入当前终端。',
  },
  /** 新建会话按钮 */
  newSession: {
    day: '写下一个问题',
    night: '开启接入',
  },
  /** 会话历史标题 */
  sessionHistory: {
    day: '对话记录',
    night: '终端日志',
  },
  /** 会话历史标题（短） */
  sessionHistoryShort: {
    day: '记录',
    night: '日志',
  },
  /** 会话搜索框占位符 */
  sessionSearchPlaceholder: {
    day: '搜索对话记录',
    night: '扫描终端日志',
  },
  /** 最近会话标题 */
  recentSessions: {
    day: '最近会话',
    night: '最近接入',
  },
  /** 快捷键提示 */
  commandHint: {
    day: 'Enter 打开首项 · Esc 关闭',
    night: 'Enter 接入首项 · Esc 断开',
  },
  /** 搜索无匹配 */
  noMatchedSession: {
    day: '没有匹配的对话',
    night: '没有匹配的日志信号',
  },
  /** 无历史记录 */
  noSessionHistory: {
    day: '暂无对话记录',
    night: '终端暂无会话日志',
  },
  /** 删除确认 */
  deleteSessionConfirm: {
    day: '确定删除这个对话？',
    night: '确认断开这段日志？',
  },
  /** 删除成功 */
  deleteSuccess: {
    day: '删除成功',
    night: '日志已断开',
  },
  /** 删除失败 */
  deleteFailed: {
    day: '删除失败',
    night: '断开失败',
  },
  /** 加载失败 */
  loadSessionFailed: {
    day: '加载对话记录失败',
    night: '加载终端日志失败',
  },
  /** 加载中 */
  loadingSession: {
    day: '加载对话记录...',
    night: '同步终端日志...',
  },

  // ── 对话区域 ──
  /** 空消息占位文案 */
  emptyMessage: {
    day: '"我们读着别人，做着自己。很高兴在我的字里，遇见你的问题。"',
    night: '"终端已接入。把问题写下，我会从旧日志和记忆芯片里调取回声。"',
  },
  /** 输入框占位符 */
  inputPlaceholder: {
    day: '输入问题，按 Enter 发送。我会从知识库中检索相关内容并回答...',
    night: '输入指令，按 Enter 接入。我会扫描档案、日志和记忆回声...',
  },
  /** 当前会话前缀 */
  activeSessionPrefix: {
    day: '当前会话',
    night: '当前链路',
  },
  /** 消息计数单位 */
  messageCountUnit: {
    day: '条消息',
    night: '条记录',
  },
  /** 新会话元数据标签 */
  newSessionMeta: {
    day: '新会话',
    night: '新链路',
  },
  /** 新建会话按钮（短） */
  newSessionShort: {
    day: '新建',
    night: '接入',
  },

  // ── Agent 思考状态 ──
  /** 思考中 */
  thinking: {
    day: '正在思考...',
    night: '正在扫描...',
  },
  /** 思考完成 */
  thinkComplete: {
    day: '思考完成',
    night: '扫描完成',
  },
  /** 思考片段 */
  thinkSegment: {
    day: '思考片段',
    night: '扫描片段',
  },
  /** 检索轮次前缀 */
  retrievalRoundPrefix: {
    day: '第',
    night: '第',
  },
  /** 检索轮次后缀 */
  retrievalRoundSuffix: {
    day: '轮检索',
    night: '轮扫描',
  },
  /** 空会话标题 */
  emptySessionTitle: {
    day: '这一页还没有写下问题',
    night: '终端暂无会话信号',
  },
});

/**
 * Chat Agent 系统指令文案
 * 控制 AI 回答的语气风格，昼夜使用不同的 system instruction。
 */
export const chatStyleVoiceCopy = defineStyleCopy({
  systemInstruction: {
    day: [
      '回答保持温和、文艺、清晰，像在书房里翻阅人生之书。',
      '可以有哲学感和文学质地，但不要牺牲准确性。',
    ].join('\n'),
    night: [
      '回答进入夜间赛博朋克状态：更像雨夜终端、记忆芯片和城市边缘的独白。',
      '可以使用终端、日志、回声、芯片、神龛、霓虹等意象，但必须保持事实准确、引用完整、语义清楚。',
      '不要把赛博朋克语气变成乱码、过度英文或无意义黑话。',
    ].join('\n'),
  },
});
