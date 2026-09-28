import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '关于博主 - NNNNzs',
  description: '了解 NNNNzs 的技术背景、本站原创文章的来源与编辑方式。',
  alternates: { canonical: '/about' },
  robots: { index: true, follow: true },
};

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-[calc(100vh-var(--header-height))] max-w-3xl px-4 py-10 prose dark:prose-invert">
      <h1>关于我与本站</h1>
      <p>
        我是 NNNNzs，一名长期进行全栈开发和工程实践的开发者。本站记录真实项目中的架构取舍、故障排查、工具开发和原创技术经验。
      </p>
      <h2>技术方向</h2>
      <p>
        主要关注 React、Next.js、Node.js、Java、数据库、云原生、AI 工程、RAG 和个人工具建设。
      </p>
      <h2>关于本站</h2>
      <p>
        文章内容主要来自实际项目、长期维护和可复现的问题排查，重点记录背景、过程、验证结果和最终取舍。
      </p>
      <p>
        你可以从<Link href="/archives">文章归档</Link>按时间阅读，也可以从<Link href="/collections">主题合集</Link>连续浏览同一方向的文章。文章会随实践更新；发布时间与修订时间分别取自文章记录，不使用网站构建时间代替。
      </p>
      <h2>联系我</h2>
      <ul>
        <li>
          Email: <a href="mailto:nnnnzs@vip.qq.com">nnnnzs@vip.qq.com</a>
        </li>
        <li>
          GitHub: <a href="https://github.com/NNNNzs">@NNNNzs</a>
        </li>
      </ul>
      <p>需要反馈文章内容、版权或数据处理问题，可查看<Link href="/contact">联系方式</Link>。本站的<Link href="/privacy">隐私政策</Link>与<Link href="/terms">免责声明和服务条款</Link>也可随时查阅。</p>
    </main>
  );
}
