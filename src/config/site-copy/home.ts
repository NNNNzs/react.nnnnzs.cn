import { defineStyleCopy } from '@/lib/site-style/copy';

export const homeFeedCopy = defineStyleCopy({
  kicker: {
    day: 'Reading Archive',
    night: 'Feed Overview',
  },
  accentTitle: {
    day: 'Reading Archive',
    night: 'Recent Posts',
  },
  heading: '最近文章',
  description: {
    day: '在温暖的书房里，整理技术、工具、运维、AI 与生活里的长期思考。',
    night: 'Neon Nomad Navigating Night Zones. 记录技术、工具、运维、AI 与生活里的长期思考。',
  },
  metricLabel: {
    day: 'Archive Count',
    night: 'Access Feed',
  },
  statusLabel: {
    day: 'Status',
    night: 'Status',
  },
  statusValue: {
    day: 'Reading',
    night: 'Streaming',
  },
  loadMore: {
    day: '加载更多文章',
    night: 'SYNC MORE LOGS',
  },
  loadMoreAriaLabel: {
    day: '加载更多文章',
    night: '同步更多文章日志',
  },
  complete: {
    day: '已加载全部文章',
    night: 'LOG STREAM COMPLETE',
  },
});
