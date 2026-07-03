import { defineStyleCopy } from '@/lib/site-style/copy';

export const bannerCopy = defineStyleCopy({
  subtitle: {
    day: 'Neon Nomad Navigating Night Zones. 白天的房间留给阅读、整理和创作，代码、运维、AI 与生活切片在阳光里排成索引。',
    night: 'Neon Nomad Navigating Night Zones. 代码、运维、AI、生活切片都收纳在这里，像深夜窗边一排还没有关掉的终端。',
  },
});

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
