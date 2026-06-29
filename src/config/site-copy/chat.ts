import { defineStyleCopy } from '@/lib/site-style/copy';

export const chatStyleCopy = defineStyleCopy({
  pageKicker: {
    day: '纸上余温',
    night: 'Relic 回响',
  },
  pageTitle: {
    day: '纸上余温',
    night: '夜间终端',
  },
  pageDescription: {
    day: '如果死后会幻化为书，这便是我提前整理出的草稿。它记录了代码的逻辑，也收纳了旅途的风尘。不必急于定义它是一本菜谱还是登记簿，只需开始对话，让故事发生。',
    night: '这是一枚接入人生之书的记忆芯片。终端会扫描旧文章、旧项目和旧回声，把散落在夜色里的线索重新接回当前会话。',
  },
  recallPanelTitle: {
    day: '回想',
    night: 'Relic 回响',
  },
  recallPanelDescription: {
    day: '在旧问题和旧答案之间，翻回那些曾经写下的页边注。',
    night: '从记忆芯片里调取旧回声，把曾经的对话重新接入当前终端。',
  },
  newSession: {
    day: '写下一个问题',
    night: '开启接入',
  },
  sessionHistory: {
    day: '对话记录',
    night: '终端日志',
  },
  sessionHistoryShort: {
    day: '记录',
    night: '日志',
  },
  sessionSearchPlaceholder: {
    day: '搜索对话记录',
    night: '扫描终端日志',
  },
  recentSessions: {
    day: '最近会话',
    night: '最近接入',
  },
  commandHint: {
    day: 'Enter 打开首项 · Esc 关闭',
    night: 'Enter 接入首项 · Esc 断开',
  },
  noMatchedSession: {
    day: '没有匹配的对话',
    night: '没有匹配的日志信号',
  },
  noSessionHistory: {
    day: '暂无对话记录',
    night: '终端暂无会话日志',
  },
  deleteSessionConfirm: {
    day: '确定删除这个对话？',
    night: '确认断开这段日志？',
  },
  deleteSuccess: {
    day: '删除成功',
    night: '日志已断开',
  },
  deleteFailed: {
    day: '删除失败',
    night: '断开失败',
  },
  loadSessionFailed: {
    day: '加载对话记录失败',
    night: '加载终端日志失败',
  },
  loadingSession: {
    day: '加载对话记录...',
    night: '同步终端日志...',
  },
  emptyMessage: {
    day: '"我们读着别人，做着自己。很高兴在我的字里，遇见你的问题。"',
    night: '"终端已接入。把问题写下，我会从旧日志和记忆芯片里调取回声。"',
  },
  inputPlaceholder: {
    day: '输入问题，按 Enter 发送。我会从知识库中检索相关内容并回答...',
    night: '输入指令，按 Enter 接入。我会扫描档案、日志和记忆回声...',
  },
  activeSessionPrefix: {
    day: '当前会话',
    night: '当前链路',
  },
  messageCountUnit: {
    day: '条消息',
    night: '条记录',
  },
  newSessionMeta: {
    day: '新会话',
    night: '新链路',
  },
  newSessionShort: {
    day: '新建',
    night: '接入',
  },
  thinking: {
    day: '正在思考...',
    night: '正在扫描...',
  },
  thinkComplete: {
    day: '思考完成',
    night: '扫描完成',
  },
  thinkSegment: {
    day: '思考片段',
    night: '扫描片段',
  },
  retrievalRoundPrefix: {
    day: '第',
    night: '第',
  },
  retrievalRoundSuffix: {
    day: '轮检索',
    night: '轮扫描',
  },
  emptySessionTitle: {
    day: '这一页还没有写下问题',
    night: '终端暂无会话信号',
  },
});

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
