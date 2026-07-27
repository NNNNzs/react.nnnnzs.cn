import Link from 'next/link';

export default function NotificationPolicyPage() {
  return <main className="mx-auto min-h-[calc(100vh-var(--header-height))] max-w-3xl px-4 py-10 prose dark:prose-invert">
    <h1>通知策略</h1>
    <p>当你的文章收到评论，或你的评论收到直接回复时，系统会默认创建一条站内通知。站内通知是主要收件箱，邮件只是额外提醒。</p>
    <p>如果对应邮件通知已开启且账号存在邮箱，系统会发送包含评论者昵称、文章标题、摘要与站内链接的邮件。邮件发送失败不会影响评论发布，也不会移除站内通知。</p>
    <p>你可以在<Link href="/c/user/info">个人中心</Link>分别关闭文章评论和评论回复的站内或邮件通知。</p>
  </main>;
}
