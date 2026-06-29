import { defineStyleCopy } from '@/lib/site-style/copy';

export const commonStyleCopy = defineStyleCopy({
  loading: {
    day: '正在翻页',
    night: '正在同步',
  },
  notFound: {
    day: '这一页似乎还是空白',
    night: '终端暂时没有检索到信号',
  },
  backToTop: {
    day: '回到顶部',
    night: '返回全景',
  },
  search: {
    day: '搜索文章',
    night: '扫描档案',
  },
  save: {
    day: '保存',
    night: '封存',
  },
  clear: {
    day: '清空',
    night: '断开链路',
  },
});
