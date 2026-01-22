/**
 * 文档资源动态读取工具
 * 用于 MCP 动态加载 docs/reference 目录下的文档
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

interface DocResource {
  name: string;
  path: string;
  content: string;
}

const DOCS_REFERENCE_DIR = join(process.cwd(), 'docs/reference');

/**
 * 获取 docs/reference 目录下的所有文档
 */
export function getReferenceDocs(): DocResource[] {
  if (!existsSync(DOCS_REFERENCE_DIR)) {
    console.warn(`⚠️ [Docs] 目录不存在: ${DOCS_REFERENCE_DIR}`);
    return [];
  }

  const docs: DocResource[] = [];

  try {
    const files = readdirSync(DOCS_REFERENCE_DIR);
    const markdownFiles = files.filter(file => file.endsWith('.md'));

    for (const file of markdownFiles) {
      const filePath = join(DOCS_REFERENCE_DIR, file);
      const stats = statSync(filePath);

      if (stats.isFile()) {
        try {
          const content = readFileSync(filePath, 'utf-8');
          docs.push({
            name: file.replace('.md', ''),
            path: `docs/reference/${file}`,
            content
          });
        } catch (error) {
          console.error(`❌ [Docs] 读取文件失败: ${file}`, error);
        }
      }
    }

    console.log(`✅ [Docs] 成功加载 ${docs.length} 个参考文档`);
    return docs;
  } catch (error) {
    console.error('❌ [Docs] 读取目录失败:', error);
    return [];
  }
}

/**
 * 获取特定文档的内容
 */
export function getReferenceDoc(name: string): DocResource | null {
  const filePath = join(DOCS_REFERENCE_DIR, `${name}.md`);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return {
      name,
      path: `docs/reference/${name}.md`,
      content
    };
  } catch (error) {
    console.error(`❌ [Docs] 读取文件失败: ${name}`, error);
    return null;
  }
}

/**
 * 获取写作风格指南
 */
export function getWritingStyleGuide(): string {
  const doc = getReferenceDoc('writing-style-guide');

  if (!doc) {
    // 如果不存在，返回默认的写作风格指南
    return getDefaultWritingStyleGuide();
  }

  return doc.content;
}

/**
 * 默认的写作风格指南（备用）
 */
function getDefaultWritingStyleGuide(): string {
  return `# 博客写作风格指南

## 核心原则
**真实、口语化、第一人称、不修饰**

---

## 通用要求

### 语言风格
- 使用"我"的第一人称视角
- 口语化、接地气，像和朋友聊天
- 多用短句，少用复杂从句
- 可以用"说实话""算了""挺好"等口语
- 允许自嘲和调侃
- 不要华丽辞藻，直白表达

### 内容组织
- 直接切入主题，不要冗长开场
- 用二级标题（##）划分部分
- 多用具体细节（时间、地点、人物）
- 可以在文中反思和对比

### 情感表达
- 情感真实，不回避负面情绪
- 可以表达迷茫、无奈、疲惫
- 但要克制，不要矫情

### 排版习惯
- 段落之间空一行
- 重要语句用 > 引用
- 代码直接用\`\`\`代码块

---

## 技术类文章

### 标题格式
"记一次+具体问题" 或 "谈谈+技术点"

### 结构
1. 开篇（2-3句话）：直接描述问题场景
2. 问题描述：具体现象、代码/配置、期望vs实际
3. 排查过程：尝试的方法、排查思路、关键线索
4. 解决方案：解决方法、解释、修改后代码
5. 结尾：简短总结或直接结束

### 语言要求
- 用"我"作为主语
- 可以说"才发现""原来""真凶是"
- 代码和配置直接贴，不过度解释
- 不炫技，真实记录问题

---

## 感怀总结类文章

### 标题选择
- 时间节点式："我在X这N年"
- 事件总结式："XXX这些事"
- 心境表达式："XXX"（四字）
- 引用式：引用诗/歌词/名言

### 开篇方式
- 时间+场景引入
- 引用+感悟
- 直入主题

### 语言风格重点
- 大量使用"我觉得""我感到""我记得"
- 适度自嘲："慌得一批""稀烂""啥都投"
- 反思：对比过去vs现在，自己vs别人
- 真实：可以表达迷茫、无奈、疲惫
- 短句为主，一句一个意思

### 细节要求
- 具体时间、地点、人物、事件
- 不需要总结，讲具体的事

### 结尾方式
- 总结性感悟
- 自然结束
- 未来展望
- 反问

---

## 避坑指南

### 不要用
- ❌ "首先...其次...最后..."
- ❌ "总而言之""综上所述"
- ❌ "值得注意的是"
- ❌ 过度四字成语
- ❌ 过度感叹号！

### 可以用
- ✅ 逗号随意用
- ✅ "说实话""算了""挺好"
- ✅ "慌得一批""稀烂""搞定"
`;
}
