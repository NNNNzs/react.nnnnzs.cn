import Link from 'next/link';

export default function PrivacyPage() {
  return <main className="mx-auto min-h-[calc(100vh-var(--header-height))] max-w-3xl px-4 py-10 prose dark:prose-invert">
    <h1>隐私政策</h1>
    <p>本站仅为账号、评论互动、站内通知和可选邮件提醒处理必要的昵称、头像、邮箱及 GitHub 授权资料。GitHub 邮箱只在本地邮箱为空时同步，不会覆盖你手动填写的地址。</p>
    <h2>通知数据</h2>
    <p>评论通知只保存事件摘要、关联文章和评论标识以及阅读状态，保留 180 天。邮件投递审计不保存评论正文，保留 90 天。</p>
    <h2>你的控制权</h2>
    <p>你可以在<Link href="/c/user/info">个人中心</Link>关闭站内或邮件通知；每封通知邮件也提供对应类型的一键退订链接。</p>
    <p>继续使用服务或注册账号即表示同意本政策。另请阅读<Link href="/notification-policy">通知策略</Link>。</p>
  </main>;
}
