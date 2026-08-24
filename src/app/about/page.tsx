import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '关于博主 - NNNNzs',
  description: '了解 NNNNzs 的技术方向、博客定位和联系方式。',
  alternates: { canonical: '/about' },
  robots: { index: true, follow: true },
};

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-[calc(100vh-var(--header-height))] max-w-3xl px-4 py-10 prose dark:prose-invert">
      <h1>关于博主</h1>
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
      <h2>联系我</h2>
      <ul>
        <li>
          Email: <a href="mailto:nnnnzs@vip.qq.com">nnnnzs@vip.qq.com</a>
        </li>
        <li>
          GitHub: <a href="https://github.com/NNNNzs">@NNNNzs</a>
        </li>
      </ul>
    </main>
  );
}
