import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '联系方式 - NNNNzs',
  description: '通过邮箱或 GitHub 联系 NNNNzs，反馈文章问题、版权事项或个人数据请求。',
  alternates: { canonical: '/contact' },
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <main className="mx-auto min-h-[calc(100vh-var(--header-height))] max-w-3xl px-4 py-10 prose dark:prose-invert">
      <h1>联系方式</h1>
      <p>欢迎就文章内容、技术讨论、引用与版权问题联系我。发送邮件时请附上相关页面链接和具体问题，方便定位。</p>
      <h2>站长邮箱</h2>
      <p><a href="mailto:nnnnzs@vip.qq.com">nnnnzs@vip.qq.com</a></p>
      <h2>GitHub</h2>
      <p>与本站代码相关的问题，也可以通过 <a href="https://github.com/NNNNzs/react.nnnnzs.cn/issues" target="_blank" rel="noopener noreferrer">项目 Issues</a> 反馈；其他公开技术交流可访问 <a href="https://github.com/NNNNzs" target="_blank" rel="noopener noreferrer">@NNNNzs</a>。</p>
      <h2>隐私与账号数据</h2>
      <p>如需查询、更正或删除本站直接保存的个人资料，请使用上述邮箱说明请求。数据处理方式见<Link href="/privacy">隐私政策</Link>。</p>
      <p>了解作者与网站：<Link href="/about">关于我与本站</Link> · <Link href="/terms">免责声明与服务条款</Link></p>
    </main>
  );
}
