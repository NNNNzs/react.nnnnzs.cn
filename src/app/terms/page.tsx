import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '免责声明与服务条款 - NNNNzs',
  description: '了解 NNNNzs 文章、外部链接、版权、账号互动与服务使用的基本说明。',
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-[calc(100vh-var(--header-height))] max-w-3xl px-4 py-10 prose dark:prose-invert">
      <h1>免责声明与服务条款</h1>
      <p><strong>更新日期：2026 年 9 月 28 日</strong></p>
      <h2>内容用途</h2>
      <p>本站文章记录作者的工程实践与个人观点，仅供学习和交流。代码、命令与配置可能随软件版本和运行环境变化；在自己的环境中使用前，请核对适用条件并做好备份。涉及安全、财务或其他专业决策时，请结合实际情况咨询相关专业人士。</p>
      <h2>版权与引用</h2>
      <p>本站由作者创作的原创内容，其版权归作者所有。引用时请标明作者和原文链接；转载、商业使用或发现内容侵权，请通过<Link href="/contact">联系方式</Link>沟通。第三方商标、图片与引用内容归各自权利人所有。</p>
      <h2>外部链接与广告</h2>
      <p>本站可能链接到第三方网站或展示广告。这些服务的内容、可用性和数据处理规则由相应提供方负责，访问前请查看其条款与隐私说明。本站的广告与统计数据处理见<Link href="/privacy">隐私政策</Link>。</p>
      <h2>互动与服务</h2>
      <p>使用评论、账号或其他互动功能时，请遵守适用法律，不发布侵权、垃圾或攻击性内容。为保护站点和其他用户，本站可能处理违反规则的内容或限制滥用行为。功能可能因维护、故障或第三方服务变化暂时不可用。</p>
      <h2>联系与更新</h2>
      <p>如发现文章错误、链接失效或需要提出版权请求，请通过<Link href="/contact">联系方式</Link>告知。条款更新后会在本页标明日期；关于作者和网站的介绍见<Link href="/about">关于我与本站</Link>。</p>
    </main>
  );
}
