import { defineStyleCopy } from '@/lib/site-style/copy';

export const collectionsCopy = defineStyleCopy({
  eyebrow: {
    day: 'Reading Collections',
    night: 'Archive Matrix',
  },
  title: {
    day: '主题书架',
    night: '归档矩阵',
  },
  description: {
    day: '把长期写作按主题装订。先从书架选中一册，再展开它的阅读线索。',
    night: '长期记录已写入不同档案单元。选中一个节点，展开它保存的日志序列。',
  },
  shelfLabel: {
    day: '书架中的合集',
    night: '可接入档案',
  },
  selectedLabel: {
    day: '当前展开',
    night: '当前接入',
  },
  enter: {
    day: '走进合集',
    night: '接入档案',
  },
  selectHint: {
    day: '选择其他封面以展开',
    night: '选择其他节点以重建索引',
  },
  empty: {
    day: '书架还在等待第一册合集。',
    night: '归档矩阵暂未检测到可用节点。',
  },
  articleUnit: {
    day: '篇文章',
    night: '条日志',
  },
  detailEyebrow: {
    day: 'Collection File',
    night: 'Archive Node',
  },
  directory: {
    day: '档案目录',
    night: '日志目录',
  },
  startReading: {
    day: '从第一篇开始',
    night: '读取首篇日志',
  },
  emptyDetail: {
    day: '这个合集还没有收录文章。',
    night: '当前节点尚未写入日志。',
  },
});
