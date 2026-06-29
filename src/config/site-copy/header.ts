import { defineStyleCopy } from '@/lib/site-style/copy';

export const headerCopy = defineStyleCopy({
  navHome: {
    day: '首页',
    night: '入口',
  },
  navArchives: {
    day: '文章',
    night: '日志',
  },
  navCollections: {
    day: '合集',
    night: '档案库',
  },
  navChat: {
    day: '回想',
    night: 'Relic',
  },
  editPost: {
    day: '编辑',
    night: '改写',
  },
  drawerTitle: {
    day: '菜单',
    night: '终端菜单',
  },
  searchButton: {
    day: '搜索文章 (Ctrl + K)',
    night: '扫描档案 (Ctrl + K)',
  },
  searchAriaLabel: {
    day: '搜索文章',
    night: '扫描档案',
  },
  themeToggleAriaLabel: {
    day: '切换昼夜风格',
    night: '切换昼夜风格',
  },
  switchToDay: {
    day: '切换到日间',
    night: '切换到日间',
  },
  switchToNight: {
    day: '切换到夜间',
    night: '切换到夜间',
  },
});
