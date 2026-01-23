/**
 * 标签颜色映射工具
 * 根据标签名称返回对应的颜色样式
 */

export interface TagColors {
  bg: string;
  text: string;
  border: string;
  darkBg: string;
  darkText: string;
  darkBorder: string;
}

const colorMap: Record<string, TagColors> = {
  'Next.js': {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-100',
    darkBg: 'dark:bg-blue-900/30',
    darkText: 'dark:text-blue-300',
    darkBorder: 'dark:border-blue-800',
  },
  'AI': {
    bg: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-100',
    darkBg: 'dark:bg-green-900/30',
    darkText: 'dark:text-green-300',
    darkBorder: 'dark:border-green-800',
  },
  '人工智能': {
    bg: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-100',
    darkBg: 'dark:bg-green-900/30',
    darkText: 'dark:text-green-300',
    darkBorder: 'dark:border-green-800',
  },
  '性能优化': {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-100',
    darkBg: 'dark:bg-purple-900/30',
    darkText: 'dark:text-purple-300',
    darkBorder: 'dark:border-purple-800',
  },
  '权限设计': {
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-100',
    darkBg: 'dark:bg-red-900/30',
    darkText: 'dark:text-red-300',
    darkBorder: 'dark:border-red-800',
  },
  'OAuth 2.0': {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-100',
    darkBg: 'dark:bg-blue-900/30',
    darkText: 'dark:text-blue-300',
    darkBorder: 'dark:border-blue-800',
  },
  'TypeScript': {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-100',
    darkBg: 'dark:bg-blue-900/30',
    darkText: 'dark:text-blue-300',
    darkBorder: 'dark:border-blue-800',
  },
  'React': {
    bg: 'bg-cyan-50',
    text: 'text-cyan-600',
    border: 'border-cyan-100',
    darkBg: 'dark:bg-cyan-900/30',
    darkText: 'dark:text-cyan-300',
    darkBorder: 'dark:border-cyan-800',
  },
  '前端开发': {
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
    border: 'border-indigo-100',
    darkBg: 'dark:bg-indigo-900/30',
    darkText: 'dark:text-indigo-300',
    darkBorder: 'dark:border-indigo-800',
  },
  '后端开发': {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-100',
    darkBg: 'dark:bg-amber-900/30',
    darkText: 'dark:text-amber-300',
    darkBorder: 'dark:border-amber-800',
  },
  '系统架构': {
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    border: 'border-orange-100',
    darkBg: 'dark:bg-orange-900/30',
    darkText: 'dark:text-orange-300',
    darkBorder: 'dark:border-orange-800',
  },
  '工程化': {
    bg: 'bg-teal-50',
    text: 'text-teal-600',
    border: 'border-teal-100',
    darkBg: 'dark:bg-teal-900/30',
    darkText: 'dark:text-teal-300',
    darkBorder: 'dark:border-teal-800',
  },
  '数据库': {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-100',
    darkBg: 'dark:bg-emerald-900/30',
    darkText: 'dark:text-emerald-300',
    darkBorder: 'dark:border-emerald-800',
  },
  '安全': {
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    border: 'border-rose-100',
    darkBg: 'dark:bg-rose-900/30',
    darkText: 'dark:text-rose-300',
    darkBorder: 'dark:border-rose-800',
  },
  'MCP': {
    bg: 'bg-violet-50',
    text: 'text-violet-600',
    border: 'border-violet-100',
    darkBg: 'dark:bg-violet-900/30',
    darkText: 'dark:text-violet-300',
    darkBorder: 'dark:border-violet-800',
  },
  'Claude': {
    bg: 'bg-violet-50',
    text: 'text-violet-600',
    border: 'border-violet-100',
    darkBg: 'dark:bg-violet-900/30',
    darkText: 'dark:text-violet-300',
    darkBorder: 'dark:border-violet-800',
  },
  'App Router': {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-200',
    darkBg: 'dark:bg-gray-800',
    darkText: 'dark:text-gray-400',
    darkBorder: 'dark:border-gray-700',
  },
  'SSG': {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-200',
    darkBg: 'dark:bg-gray-800',
    darkText: 'dark:text-gray-400',
    darkBorder: 'dark:border-gray-700',
  },
  'RBAC': {
    bg: 'bg-yellow-50',
    text: 'text-yellow-600',
    border: 'border-yellow-100',
    darkBg: 'dark:bg-yellow-900/30',
    darkText: 'dark:text-yellow-300',
    darkBorder: 'dark:border-yellow-800',
  },
};

/**
 * 获取标签颜色样式
 */
export function getTagColor(tag: string): TagColors {
  return colorMap[tag] || {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-200',
    darkBg: 'dark:bg-gray-800',
    darkText: 'dark:text-gray-400',
    darkBorder: 'dark:border-gray-700',
  };
}

/**
 * 获取标签完整的 className
 */
export function getTagClassName(tag: string): string {
  const colors = getTagColor(tag);
  return `px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border} ${colors.darkBg} ${colors.darkText} ${colors.darkBorder}`;
}
